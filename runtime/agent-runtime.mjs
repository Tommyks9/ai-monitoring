import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

loadLocalEnv();

const port = Number(process.env.AGENT_RUNTIME_PORT ?? 4000);
const authToken = process.env.AGENT_RUNTIME_TOKEN ?? "";
const dispatcherEnabled = process.env.AGENT_RUNTIME_DISPATCHER !== "false";
const dispatcherIntervalMs = Number(process.env.AGENT_RUNTIME_DISPATCH_INTERVAL_MS ?? 4000);
const dispatchMode = process.env.AGENT_DISPATCH_MODE ?? "hybrid";
const systemBlueprint = readJson("blueprints/system-blueprint.json");
const agentRegistry = readJson("blueprints/agent-registry.json");
const agentRuntimeContract = readOptionalJson("blueprints/agent-runtime-contract.json", {
  agents: [],
  fine_tuning: {},
});
const teamByAgent = new Map(
  agentRegistry.teams.flatMap((team) => team.agents.map((agentId) => [agentId, team.name])),
);
const agentNameById = new Map(agentRegistry.agents.map((agent) => [agent.id, agent.name]));
const runtimeAgentById = new Map(agentRuntimeContract.agents.map((agent) => [agent.id, agent]));

const workStates = new Set(["queued", "in_progress", "review", "blocked", "done"]);
const agentStatuses = new Set(["working", "review", "idle", "blocked"]);
const eventTypes = new Set(["handoff", "decision", "test", "blocker", "deploy"]);
let tickIndex = 0;

const state = {
  agentRuns: createAgentRuns(),
  workItems: createWorkItems(),
  agentEvents: createEvents(),
  serviceReadiness: createServiceReadiness(),
};
const activeAssignments = new Map(
  state.workItems
    .filter((item) => item.state === "in_progress")
    .map((item) => [
      item.id,
      {
        workItemId: item.id,
        agentRunId: item.assignedRunId ?? findAgentRunByOwner(item.owner)?.id,
        progress: item.progress ?? 15,
        reviewTicks: 0,
        mode: item.dispatchMode ?? "local",
      },
    ]),
);

const server = createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    if (!isAuthorized(request)) {
      sendJson(response, 401, { error: "ไม่ได้รับอนุญาต" });
      return;
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const pathname = url.pathname;

    if (request.method === "GET" && pathname === "/") {
      sendJson(response, 200, {
        name: "OunJai Agent Runtime",
        status: "online",
        endpoints: [
          "GET /health",
          "GET /api/agents",
          "GET /api/work-items",
          "GET /api/events",
          "GET /api/services/readiness",
          "GET /api/snapshot",
          "GET /api/dispatch/status",
          "POST /api/work-items",
          "POST /api/dispatch/run-once",
          "PATCH /api/work-items/:id/state",
          "POST /api/agent-runs/:id/events",
          "POST /api/agent-runs/:id/heartbeat",
        ],
      });
      return;
    }

    if (request.method === "GET" && pathname === "/health") {
      sendJson(response, 200, {
        status: "ok",
        agents: state.agentRuns.length,
        workItems: state.workItems.length,
        events: state.agentEvents.length,
        dispatcher: dispatcherEnabled ? "enabled" : "disabled",
        dispatchMode,
        activeAssignments: activeAssignments.size,
        queueDepth: state.workItems.filter((item) => item.state === "queued").length,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/agents") {
      sendJson(response, 200, state.agentRuns);
      return;
    }

    if (request.method === "GET" && pathname === "/api/work-items") {
      sendJson(response, 200, state.workItems);
      return;
    }

    if (request.method === "GET" && pathname === "/api/events") {
      sendJson(response, 200, state.agentEvents);
      return;
    }

    if (request.method === "GET" && pathname === "/api/services/readiness") {
      sendJson(response, 200, state.serviceReadiness);
      return;
    }

    if (request.method === "GET" && pathname === "/api/snapshot") {
      sendJson(response, 200, state);
      return;
    }

    if (request.method === "GET" && pathname === "/api/dispatch/status") {
      sendJson(response, 200, getDispatchStatus());
      return;
    }

    if (request.method === "POST" && pathname === "/api/dispatch/run-once") {
      const result = await runDispatcherCycle({ manual: true });
      sendJson(response, 200, {
        ...getDispatchStatus(),
        result,
      });
      return;
    }

    if (request.method === "POST" && pathname === "/api/work-items") {
      const body = await readJsonBody(request);
      const workItem = createWorkItem(body);
      state.workItems.unshift(workItem);
      addEvent({
        agent: workItem.owner,
        type: "handoff",
        message: `เพิ่มงาน ${workItem.id} เข้าคิวแล้ว: ${workItem.title}`,
      });
      await runDispatcherCycle({ manual: true });
      sendJson(response, 201, workItem);
      return;
    }

    const stateMatch = pathname.match(/^\/api\/work-items\/([^/]+)\/state$/);
    if (request.method === "PATCH" && stateMatch) {
      const body = await readJsonBody(request);
      const workItem = state.workItems.find((item) => item.id === stateMatch[1]);

      if (!workItem) {
        sendJson(response, 404, { error: "ไม่พบ work item" });
        return;
      }

      if (!workStates.has(body.state)) {
        sendJson(response, 400, { error: "สถานะงานไม่ถูกต้อง" });
        return;
      }

      workItem.state = body.state;
      workItem.dispatchStatus = toDispatchStatus(body.state);
      workItem.progress = body.state === "done" ? 100 : workItem.progress;
      workItem.updatedAt = currentTime();
      if (body.handoff) {
        workItem.handoff = body.handoff;
      }
      if (body.lastSignal) {
        workItem.lastSignal = body.lastSignal;
      }
      if (workItem.state === "done" || workItem.state === "blocked") {
        activeAssignments.delete(workItem.id);
      }
      addEvent({
        agent: body.agent ?? workItem.owner,
        type: body.state === "blocked" ? "blocker" : "handoff",
        message: body.note ?? `${workItem.id} เปลี่ยนสถานะเป็น ${toThaiWorkState(body.state)}`,
      });
      sendJson(response, 200, workItem);
      return;
    }

    const eventMatch = pathname.match(/^\/api\/agent-runs\/([^/]+)\/events$/);
    if (request.method === "POST" && eventMatch) {
      const body = await readJsonBody(request);
      const agentRun = findAgentRun(eventMatch[1]);

      if (!agentRun) {
        sendJson(response, 404, { error: "ไม่พบ agent run" });
        return;
      }

      updateAgentRun(agentRun, body);
      if (body.workItemId) {
        updateWorkItemFromAgent(body.workItemId, agentRun, body);
      }
      const event = addEvent({
        agent: body.agent ?? agentRun.agentName,
        type: eventTypes.has(body.type) ? body.type : "handoff",
        message: body.message ?? agentRun.lastSignal,
      });
      sendJson(response, 201, { agentRun, event });
      return;
    }

    const heartbeatMatch = pathname.match(/^\/api\/agent-runs\/([^/]+)\/heartbeat$/);
    if (request.method === "POST" && heartbeatMatch) {
      const body = await readJsonBody(request);
      const agentRun = findAgentRun(heartbeatMatch[1]);

      if (!agentRun) {
        sendJson(response, 404, { error: "ไม่พบ agent run" });
        return;
      }

      updateAgentRun(agentRun, body);
      agentRun.lastSignal = body.lastSignal ?? `ได้รับ heartbeat เวลา ${currentTime()}`;
      if (body.workItemId) {
        updateWorkItemFromAgent(body.workItemId, agentRun, body);
      }
      sendJson(response, 200, agentRun);
      return;
    }

    sendJson(response, 404, { error: "ไม่พบ route นี้" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิด runtime error ที่ไม่ทราบสาเหตุ";
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, () => {
  console.log(`OunJai Agent Runtime พร้อมใช้งานที่ http://localhost:${port}`);
  console.log(authToken ? "เปิดใช้งาน Bearer token แล้ว" : "ยังไม่ได้เปิด Bearer token เหมาะสำหรับ local development");
  console.log(
    dispatcherEnabled
      ? `เปิด dispatcher loop แล้ว (${dispatcherIntervalMs}ms, โหมด: ${dispatchMode})`
      : "ปิด dispatcher loop แล้ว",
  );
});

if (dispatcherEnabled) {
  setInterval(() => {
    runDispatcherCycle().catch((error) => {
      const message = error instanceof Error ? error.message : "ไม่ทราบสาเหตุของ dispatcher error";
      addEvent({
        agent: "Agent Runtime",
        type: "blocker",
        message: `รอบ dispatcher ล้มเหลว: ${message}`,
      });
    });
  }, dispatcherIntervalMs);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(rootDir, relativePath), "utf8"));
}

function readOptionalJson(relativePath, fallback) {
  const filePath = join(rootDir, relativePath);
  if (!existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(readFileSync(filePath, "utf8"));
}

function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = join(rootDir, fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    const content = readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").trim().replace(/^['"]|['"]$/g, "");
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

function createAgentRuns() {
  const currentTasks = {
    "architect-agent": "ล็อกขอบเขต Saga ของ trip/payment และ contract ของ gateway",
    "shared-lib-agent": "เตรียมแพ็กเกจ contract กลางใน /libs/common สำหรับ proto, logger และ exception filter",
    "lead-developer-agent": "สร้างโครง NestJS services จาก system-blueprint.json",
    "database-engineer-agent": "ออกแบบ 2dsphere index ของ location และ consistency model ของ trip",
    "frontend-agent": "เตรียม dashboard admin และ mobile flows จาก gateway contracts",
    "qa-automation-agent": "ร่าง acceptance matrix สำหรับการจองรถและการชำระเงิน",
    "documentation-agent": "สร้าง template README ราย service และ backlog sequence diagram ของ gRPC",
  };
  const statuses = ["review", "working", "working", "blocked", "idle", "review", "working"];
  const health = [92, 88, 84, 71, 86, 90, 94];
  const progress = [78, 64, 52, 41, 26, 58, 70];

  return agentRegistry.agents.map((agent, index) => ({
    id: `run-${agent.id.replace("-agent", "")}-001`,
    agentId: agent.id,
    agentName: agent.name,
    team: teamByAgent.get(agent.id) ?? "ยังไม่ระบุทีม",
    status: statuses[index] ?? "idle",
    currentTask: currentTasks[agent.id] ?? "รอรับงานถัดไป",
    health: health[index] ?? 80,
    progress: progress[index] ?? 10,
    queueDepth: index + 2,
    lastSignal: "เริ่มต้น runtime จาก OunJai agent registry แล้ว",
    risk: agent.approval_gates?.[0] ?? "ยังไม่มีความเสี่ยงที่ต้องเฝ้าระวัง",
  }));
}

function createWorkItems() {
  return [
    {
      id: "OUNJAI-001",
      title: "สร้าง foundation ของ /libs/common",
      owner: "Shared Lib Agent",
      priority: "critical",
      state: "in_progress",
      dispatchStatus: "running",
      service: "/libs/common",
      acceptanceGate: "ห้ามมี DTO/logger/exception code ซ้ำใน service ต่าง ๆ",
      assignedRunId: "run-shared-lib-001",
      dispatchMode: "local",
      progress: 64,
      startedAt: currentTime(),
      lastSignal: "Shared Lib Agent กำลังสกัด common contracts",
      updatedAt: currentTime(),
    },
    {
      id: "OUNJAI-002",
      title: "สร้างโครง NestJS services ทั้ง 9 ตัว",
      owner: "Lead Developer Agent",
      priority: "critical",
      state: "queued",
      dispatchStatus: "waiting",
      service: "ทุก service",
      acceptanceGate: "ports 60051-60059 ต้องตรงกับ blueprint",
      progress: 0,
      updatedAt: currentTime(),
    },
    {
      id: "OUNJAI-003",
      title: "ออกแบบ schema สำหรับ location tracking",
      owner: "Database Engineer Agent",
      priority: "high",
      state: "blocked",
      dispatchStatus: "blocked",
      service: "location-service",
      acceptanceGate: "ต้องมี 2dsphere index และนโยบาย stale location ในเอกสาร",
      progress: 35,
      lastSignal: "ติดขัดจนกว่าจะสรุปชื่อ state ของ trip",
      updatedAt: currentTime(),
    },
    {
      id: "OUNJAI-004",
      title: "สร้าง acceptance matrix สำหรับ trip/payment",
      owner: "QA Automation Agent",
      priority: "high",
      state: "review",
      dispatchStatus: "review",
      service: "trip-service, payment-service",
      acceptanceGate: "ต้องมีรายการ test ป้องกันตัดเงินซ้ำและจองซ้ำ",
      progress: 92,
      handoff: "acceptance matrix พร้อมให้ product ตรวจแล้ว",
      updatedAt: currentTime(),
    },
  ];
}

function createEvents() {
  return [
    {
      id: "evt-001",
      time: currentTime(),
      agent: "Architect Agent",
      type: "decision",
      message: "เลือก Saga + Transaction Outbox เป็น pattern หลักสำหรับ consistency ของ trip/payment",
    },
    {
      id: "evt-002",
      time: currentTime(),
      agent: "Shared Lib Agent",
      type: "handoff",
      message: "เผยแพร่ขอบเขต shared contract สำหรับ proto, DTO, logger และ exception modules แล้ว",
    },
  ];
}

function createServiceReadiness() {
  const readinessSeed = [42, 38, 46, 35, 33, 28, 30, 24, 26];

  return systemBlueprint.services.map((service, index) => ({
    name: service.name,
    port: service.port,
    database: service.db,
    coreLogic: service.core_logic,
    owner: index < 4 ? "Lead Developer Agent" : index < 7 ? "Database Engineer Agent" : "Documentation Agent",
    readiness: readinessSeed[index] ?? 25,
    nextGate:
      service.name === "location-service"
        ? "แผน 2dsphere index"
        : service.name === "trip-service" || service.name === "payment-service"
          ? "gate consistency และ idempotency"
          : "โครง Clean Architecture",
  }));
}

function createWorkItem(body) {
  if (!body.title || !body.owner) {
    throw new Error("ต้องระบุชื่องานและ agent ผู้รับผิดชอบ");
  }

  const nextNumber = String(state.workItems.length + 1).padStart(3, "0");
  return {
    id: body.id ?? `OUNJAI-${nextNumber}`,
    title: body.title,
    owner: body.owner,
    priority: body.priority ?? "medium",
    state: body.state ?? "queued",
    dispatchStatus: toDispatchStatus(body.state ?? "queued"),
    service: body.service ?? "unassigned",
    acceptanceGate: body.acceptanceGate ?? "รอระบุเกณฑ์ผ่านงาน",
    progress: 0,
    updatedAt: currentTime(),
  };
}

function findAgentRun(id) {
  return state.agentRuns.find((run) => run.id === id || run.agentId === id);
}

function findAgentRunByOwner(owner) {
  const normalizedOwner = normalize(owner);
  return state.agentRuns.find(
    (run) => normalize(run.agentName) === normalizedOwner || normalize(run.agentId) === normalizedOwner,
  );
}

function updateAgentRun(agentRun, body) {
  if (body.status && agentStatuses.has(body.status)) {
    agentRun.status = body.status;
  }
  if (typeof body.health === "number") {
    agentRun.health = clamp(body.health);
  }
  if (typeof body.progress === "number") {
    agentRun.progress = clamp(body.progress);
  }
  if (typeof body.queueDepth === "number") {
    agentRun.queueDepth = Math.max(0, Math.round(body.queueDepth));
  }
  if (body.currentTask) {
    agentRun.currentTask = body.currentTask;
  }
  if (body.lastSignal) {
    agentRun.lastSignal = body.lastSignal;
  }
  if (body.risk) {
    agentRun.risk = body.risk;
  }
}

function addEvent({ agent, type, message }) {
  const event = {
    id: `evt-${String(state.agentEvents.length + 1).padStart(3, "0")}`,
    time: currentTime(),
    agent,
    type,
    message,
  };

  state.agentEvents.unshift(event);
  state.agentEvents = state.agentEvents.slice(0, 30);
  return event;
}

async function dispatchToAgentRunner(agentRun, workItem, runnerUrl) {
  try {
    const response = await fetch(runnerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.AGENT_RUNNER_TOKEN ? { Authorization: `Bearer ${process.env.AGENT_RUNNER_TOKEN}` } : {}),
      },
      body: JSON.stringify(createAgentDispatchPayload(agentRun, workItem)),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `agent runner ตอบกลับด้วยสถานะ ${response.status}`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "ไม่ทราบสาเหตุของ agent runner dispatch error",
    };
  }
}

function createAgentDispatchPayload(agentRun, workItem) {
  const agentDefinition = agentRegistry.agents.find((agent) => agent.id === agentRun.agentId);
  const runtimeAgent = runtimeAgentById.get(agentRun.agentId);

  return {
    event: "work_item.assigned",
    runtime: {
      name: "OunJai Agent Runtime",
      callbackBaseUrl: process.env.AGENT_RUNTIME_PUBLIC_URL ?? `http://localhost:${port}`,
    },
    communication: {
      language: "th-TH",
      policy: "ตอบกลับและส่ง handoff/progress/error เป็นภาษาไทยก่อนเสมอ ยกเว้นชื่อไฟล์ โค้ด command endpoint และ identifier ทางเทคนิค",
    },
    agent: {
      id: agentRun.agentId,
      name: agentRun.agentName,
      team: agentRun.team,
      prompt: runtimeAgent?.prompt ?? "",
      fineTuningProfile: runtimeAgent?.fine_tuning_profile ?? "",
      primaryInputs: agentDefinition?.primary_inputs ?? [],
      primaryOutputs: agentDefinition?.primary_outputs ?? [],
      approvalGates: agentDefinition?.approval_gates ?? [],
    },
    workItem,
    sourceOfTruth: {
      systemBlueprint,
      agentRegistry: {
        model_name: agentRegistry.model_name,
        version: agentRegistry.version,
        global_rules: agentRegistry.global_rules,
      },
      fineTuning: agentRuntimeContract.fine_tuning,
    },
    callbackEndpoints: {
      heartbeat: `/api/agent-runs/${agentRun.agentId}/heartbeat`,
      events: `/api/agent-runs/${agentRun.agentId}/events`,
      state: `/api/work-items/${workItem.id}/state`,
    },
  };
}

function updateWorkItemFromAgent(workItemId, agentRun, body) {
  const item = state.workItems.find((workItem) => workItem.id === workItemId);
  if (!item) {
    return;
  }

  if (typeof body.progress === "number") {
    item.progress = clamp(body.progress);
  }
  if (body.status === "review" || body.state === "review") {
    item.state = "review";
    item.dispatchStatus = "review";
  }
  if (body.status === "blocked" || body.state === "blocked") {
    item.state = "blocked";
    item.dispatchStatus = "blocked";
    activeAssignments.delete(item.id);
  }
  if (body.state === "done") {
    item.state = "done";
    item.dispatchStatus = "completed";
    item.progress = 100;
    item.completedAt = currentTime();
    activeAssignments.delete(item.id);
  }
  if (body.handoff) {
    item.handoff = body.handoff;
  }
  if (body.lastSignal) {
    item.lastSignal = body.lastSignal;
  }

  item.updatedAt = currentTime();
  agentRun.currentTask = item.state === "done" ? "รอรับงานถัดไป" : item.title;
}

function blockWorkItem(item, agent, reason) {
  item.state = "blocked";
  item.dispatchStatus = "blocked";
  item.lastSignal = reason;
  item.updatedAt = currentTime();
  addEvent({
    agent,
    type: "blocker",
    message: `${item.id} blocked: ${reason}`,
  });
}

function isAgentBusy(agentRun) {
  return Array.from(activeAssignments.values()).some((assignment) => assignment.agentRunId === agentRun.id);
}

function getAgentRunnerUrl(agentId) {
  const normalized = agentId.replace(/-/g, "_").toUpperCase();
  return process.env[`AGENT_RUNNER_${normalized}_URL`] ?? process.env.AGENT_RUNNER_URL ?? "";
}

function getAgentStep(agentId, priority) {
  const priorityBoost = {
    critical: 7,
    high: 6,
    medium: 5,
    low: 4,
  }[priority] ?? 5;
  const agentBoost = agentId === "lead-developer-agent" || agentId === "shared-lib-agent" ? 3 : 2;
  return priorityBoost + agentBoost;
}

function createAgentSignal(agentRun, item, progress) {
  if (progress < 30) {
    return `${agentRun.agentName} กำลังอ่าน blueprint และ acceptance gate ของงาน ${item.id}`;
  }
  if (progress < 65) {
    return `${agentRun.agentName} กำลังทำงานส่วน ${item.service} สำหรับงาน ${item.id}`;
  }
  if (progress < 100) {
    return `${agentRun.agentName} กำลังตรวจผลลัพธ์ของงาน ${item.id}`;
  }
  return `${agentRun.agentName} ทำงาน ${item.id} เสร็จแล้ว`;
}

function createHandoff(agentRun, item) {
  return `Handoff จาก ${agentRun.agentName} สำหรับงาน ${item.id}: ${item.title} พร้อมตรวจแล้ว เกณฑ์ผ่านงาน: ${item.acceptanceGate}`;
}

function updateServiceReadiness(serviceName, priority) {
  const services =
    serviceName === "ทุก service" || serviceName === "all services"
      ? state.serviceReadiness
      : state.serviceReadiness.filter((service) => service.name === serviceName);

  for (const service of services) {
    service.readiness = clamp(service.readiness + (priority === "critical" ? 2 : 1));
  }
}

function updateQueueDepths() {
  for (const agentRun of state.agentRuns) {
    agentRun.queueDepth = state.workItems.filter(
      (item) => item.owner === agentRun.agentName && (item.state === "queued" || item.state === "in_progress"),
    ).length;
  }
}

function getDispatchStatus() {
  return {
    enabled: dispatcherEnabled,
    mode: dispatchMode,
    intervalMs: dispatcherIntervalMs,
    activeAssignments: Array.from(activeAssignments.values()),
    queueDepth: state.workItems.filter((item) => item.state === "queued").length,
    inProgress: state.workItems.filter((item) => item.state === "in_progress").length,
    review: state.workItems.filter((item) => item.state === "review").length,
    done: state.workItems.filter((item) => item.state === "done").length,
  };
}

async function runDispatcherCycle({ manual = false } = {}) {
  tickIndex += 1;
  const dispatched = await dispatchQueuedWork();
  const progressed = progressActiveAssignments();
  const reviewed = completeReviewedWork();
  updateQueueDepths();

  return {
    manual,
    dispatched,
    progressed,
    reviewed,
    activeAssignments: activeAssignments.size,
    queueDepth: state.workItems.filter((item) => item.state === "queued").length,
  };
}

async function dispatchQueuedWork() {
  let dispatched = 0;
  const queuedItems = state.workItems.filter((item) => item.state === "queued");

  for (const item of queuedItems) {
    const agentRun = findAgentRunByOwner(item.owner);

    if (!agentRun) {
      blockWorkItem(item, item.owner, `ไม่พบ agent ที่ลงทะเบียนไว้สำหรับผู้รับผิดชอบ ${item.owner}`);
      continue;
    }

    if (isAgentBusy(agentRun)) {
      continue;
    }

    const runnerUrl = getAgentRunnerUrl(agentRun.agentId);
    const mode = runnerUrl && dispatchMode !== "local" ? "webhook" : "local";

    item.state = "in_progress";
    item.dispatchStatus = mode === "webhook" ? "sent_to_agent" : "assigned";
    item.assignedRunId = agentRun.id;
    item.dispatchMode = mode;
    item.runnerUrl = runnerUrl ? publicUrlLabel(runnerUrl) : undefined;
    item.progress = 5;
    item.startedAt = currentTime();
    item.updatedAt = currentTime();
    item.lastSignal = `${agentRun.agentName} รับงาน ${item.id} แล้ว`;

    agentRun.status = "working";
    agentRun.currentTask = item.title;
    agentRun.progress = item.progress;
    agentRun.lastSignal = `รับงาน ${item.id}: ${item.title}`;
    agentRun.risk = item.acceptanceGate;

    activeAssignments.set(item.id, {
      workItemId: item.id,
      agentRunId: agentRun.id,
      progress: item.progress,
      reviewTicks: 0,
      mode,
    });

    if (mode === "webhook") {
      const delivery = await dispatchToAgentRunner(agentRun, item, runnerUrl);
      if (!delivery.ok) {
        if (dispatchMode === "webhook") {
          activeAssignments.delete(item.id);
          blockWorkItem(item, agentRun.agentName, delivery.error);
          agentRun.status = "blocked";
          agentRun.lastSignal = delivery.error;
          continue;
        }

        item.dispatchMode = "local";
        item.dispatchStatus = "assigned";
        activeAssignments.get(item.id).mode = "local";
        item.lastSignal = `webhook ใช้งานไม่ได้ จึง fallback เป็น local worker (${delivery.error})`;
      } else {
        item.dispatchStatus = "sent_to_agent";
        item.lastSignal = `ส่งงาน ${item.id} ไปยัง runner ภายนอก ${publicUrlLabel(runnerUrl)} แล้ว`;
      }
    }

    addEvent({
      agent: agentRun.agentName,
      type: "handoff",
      message:
        mode === "webhook"
          ? `Dispatcher ส่งงาน ${item.id} ไปยัง runner จริงของ ${agentRun.agentName} แล้ว`
          : `Dispatcher มอบหมายงาน ${item.id} ให้ local worker ของ ${agentRun.agentName} แล้ว`,
    });
    dispatched += 1;
  }

  return dispatched;
}

function progressActiveAssignments() {
  let progressed = 0;

  for (const assignment of activeAssignments.values()) {
    const item = state.workItems.find((workItem) => workItem.id === assignment.workItemId);
    const agentRun = state.agentRuns.find((run) => run.id === assignment.agentRunId);

    if (!item || !agentRun || item.state !== "in_progress") {
      continue;
    }

    if (assignment.mode === "webhook") {
      item.updatedAt = currentTime();
      item.dispatchStatus = "sent_to_agent";
      agentRun.lastSignal = `กำลังรอ heartbeat จาก external runner สำหรับงาน ${item.id}`;
      continue;
    }

    assignment.progress = clamp(assignment.progress + getAgentStep(agentRun.agentId, item.priority));
    item.progress = assignment.progress;
    item.dispatchStatus = assignment.progress >= 100 ? "review" : "running";
    item.updatedAt = currentTime();
    item.lastSignal = createAgentSignal(agentRun, item, assignment.progress);

    agentRun.status = assignment.progress >= 100 ? "review" : "working";
    agentRun.progress = assignment.progress >= 100 ? 92 : assignment.progress;
    agentRun.health = clamp(agentRun.health + (assignment.progress % 3 === 0 ? 1 : 0));
    agentRun.lastSignal = item.lastSignal;

    updateServiceReadiness(item.service, item.priority);

    if (assignment.progress >= 100) {
      item.state = "review";
      item.progress = 100;
      item.handoff = createHandoff(agentRun, item);
      item.lastSignal = `${agentRun.agentName} สร้าง handoff สำหรับงาน ${item.id} แล้ว`;
      addEvent({
        agent: agentRun.agentName,
        type: agentRun.agentId === "qa-automation-agent" ? "test" : "handoff",
        message: item.handoff,
      });
    }

    progressed += 1;
  }

  return progressed;
}

function completeReviewedWork() {
  let reviewed = 0;

  for (const [workItemId, assignment] of activeAssignments.entries()) {
    const item = state.workItems.find((workItem) => workItem.id === workItemId);
    const agentRun = state.agentRuns.find((run) => run.id === assignment.agentRunId);

    if (!item || !agentRun || item.state !== "review") {
      continue;
    }

    assignment.reviewTicks += 1;
    agentRun.status = "review";
    agentRun.progress = 96;
    agentRun.lastSignal = `กำลังตรวจงาน ${item.id}: ${item.acceptanceGate}`;

    if (assignment.reviewTicks < 2) {
      continue;
    }

    item.state = "done";
    item.dispatchStatus = "completed";
    item.progress = 100;
    item.completedAt = currentTime();
    item.updatedAt = currentTime();
    item.lastSignal = `งาน ${item.id} ผ่าน acceptance gate แล้ว`;

    agentRun.status = "idle";
    agentRun.progress = 0;
    agentRun.currentTask = "รอรับงานถัดไป";
    agentRun.lastSignal = `งาน ${item.id} เสร็จแล้ว พร้อมรับ dispatch ถัดไป`;

    activeAssignments.delete(workItemId);
    addEvent({
      agent: agentRun.agentName,
      type: "deploy",
      message: `งาน ${item.id} เสร็จแล้ว: ${item.acceptanceGate}`,
    });
    reviewed += 1;
  }

  return reviewed;
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function isAuthorized(request) {
  if (!authToken) {
    return true;
  }

  return request.headers.authorization === `Bearer ${authToken}`;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", process.env.AGENT_RUNTIME_CORS_ORIGIN ?? "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function toDispatchStatus(stateValue) {
  return (
    {
      queued: "waiting",
      in_progress: "running",
      review: "review",
      blocked: "blocked",
      done: "completed",
    }[stateValue] ?? "waiting"
  );
}

function toThaiWorkState(stateValue) {
  return (
    {
      queued: "รอคิว",
      in_progress: "กำลังทำ",
      review: "รอตรวจ",
      blocked: "ติดขัด",
      done: "เสร็จแล้ว",
    }[stateValue] ?? stateValue
  );
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function publicUrlLabel(value) {
  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    return "runner ที่ตั้งค่าไว้";
  }
}

function currentTime() {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date());
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
