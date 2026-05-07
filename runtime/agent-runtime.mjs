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
const systemBlueprint = readJson("blueprints/system-blueprint.json");
const agentRegistry = readJson("blueprints/agent-registry.json");
const teamByAgent = new Map(
  agentRegistry.teams.flatMap((team) => team.agents.map((agentId) => [agentId, team.name])),
);
const agentNameById = new Map(agentRegistry.agents.map((agent) => [agent.id, agent.name]));

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

const server = createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    if (!isAuthorized(request)) {
      sendJson(response, 401, { error: "Unauthorized" });
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
          "POST /api/work-items",
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

    if (request.method === "POST" && pathname === "/api/work-items") {
      const body = await readJsonBody(request);
      const workItem = createWorkItem(body);
      state.workItems.unshift(workItem);
      addEvent({
        agent: workItem.owner,
        type: "handoff",
        message: `Queued ${workItem.id}: ${workItem.title}`,
      });
      sendJson(response, 201, workItem);
      return;
    }

    const stateMatch = pathname.match(/^\/api\/work-items\/([^/]+)\/state$/);
    if (request.method === "PATCH" && stateMatch) {
      const body = await readJsonBody(request);
      const workItem = state.workItems.find((item) => item.id === stateMatch[1]);

      if (!workItem) {
        sendJson(response, 404, { error: "Work item not found" });
        return;
      }

      if (!workStates.has(body.state)) {
        sendJson(response, 400, { error: "Invalid work item state" });
        return;
      }

      workItem.state = body.state;
      workItem.updatedAt = currentTime();
      addEvent({
        agent: body.agent ?? workItem.owner,
        type: body.state === "blocked" ? "blocker" : "handoff",
        message: body.note ?? `${workItem.id} moved to ${body.state}`,
      });
      sendJson(response, 200, workItem);
      return;
    }

    const eventMatch = pathname.match(/^\/api\/agent-runs\/([^/]+)\/events$/);
    if (request.method === "POST" && eventMatch) {
      const body = await readJsonBody(request);
      const agentRun = findAgentRun(eventMatch[1]);

      if (!agentRun) {
        sendJson(response, 404, { error: "Agent run not found" });
        return;
      }

      updateAgentRun(agentRun, body);
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
        sendJson(response, 404, { error: "Agent run not found" });
        return;
      }

      updateAgentRun(agentRun, body);
      agentRun.lastSignal = body.lastSignal ?? `Heartbeat received at ${currentTime()}`;
      sendJson(response, 200, agentRun);
      return;
    }

    sendJson(response, 404, { error: "Route not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown runtime error";
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, () => {
  console.log(`OunJai Agent Runtime listening on http://localhost:${port}`);
  console.log(authToken ? "Bearer token auth is enabled." : "Bearer token auth is disabled.");
});

setInterval(simulateAgentWork, 8000);

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(rootDir, relativePath), "utf8"));
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
    "architect-agent": "Lock trip/payment saga boundaries and gateway contracts",
    "shared-lib-agent": "Prepare /libs/common contract package for proto, logger and exception filter",
    "lead-developer-agent": "Generate NestJS service skeletons from system-blueprint.json",
    "database-engineer-agent": "Design location 2dsphere index and trip consistency model",
    "frontend-agent": "Prepare admin dashboard and mobile flows from gateway contracts",
    "qa-automation-agent": "Draft acceptance matrix for trip booking and payment flows",
    "documentation-agent": "Create service README template and gRPC sequence diagram backlog",
  };
  const statuses = ["review", "working", "working", "blocked", "idle", "review", "working"];
  const health = [92, 88, 84, 71, 86, 90, 94];
  const progress = [78, 64, 52, 41, 26, 58, 70];

  return agentRegistry.agents.map((agent, index) => ({
    id: `run-${agent.id.replace("-agent", "")}-001`,
    agentId: agent.id,
    agentName: agent.name,
    team: teamByAgent.get(agent.id) ?? "Unassigned",
    status: statuses[index] ?? "idle",
    currentTask: currentTasks[agent.id] ?? "Waiting for task assignment",
    health: health[index] ?? 80,
    progress: progress[index] ?? 10,
    queueDepth: index + 2,
    lastSignal: "Runtime seeded from OunJai agent registry",
    risk: agent.approval_gates?.[0] ?? "No active risk",
  }));
}

function createWorkItems() {
  return [
    {
      id: "OUNJAI-001",
      title: "Create /libs/common foundation",
      owner: "Shared Lib Agent",
      priority: "critical",
      state: "in_progress",
      service: "/libs/common",
      acceptanceGate: "No duplicated DTO/logger/exception code in services",
      updatedAt: currentTime(),
    },
    {
      id: "OUNJAI-002",
      title: "Generate 9 NestJS service skeletons",
      owner: "Lead Developer Agent",
      priority: "critical",
      state: "queued",
      service: "all services",
      acceptanceGate: "Ports 60051-60059 match blueprint",
      updatedAt: currentTime(),
    },
    {
      id: "OUNJAI-003",
      title: "Design location tracking schema",
      owner: "Database Engineer Agent",
      priority: "high",
      state: "blocked",
      service: "location-service",
      acceptanceGate: "2dsphere index and stale-location policy documented",
      updatedAt: currentTime(),
    },
    {
      id: "OUNJAI-004",
      title: "Build trip/payment acceptance matrix",
      owner: "QA Automation Agent",
      priority: "high",
      state: "review",
      service: "trip-service, payment-service",
      acceptanceGate: "Duplicate charge and duplicate booking tests listed",
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
      message: "Selected Saga + Transaction Outbox as the default trip/payment consistency pattern.",
    },
    {
      id: "evt-002",
      time: currentTime(),
      agent: "Shared Lib Agent",
      type: "handoff",
      message: "Published shared contract boundary for proto, DTO, logger and exception modules.",
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
        ? "2dsphere index plan"
        : service.name === "trip-service" || service.name === "payment-service"
          ? "consistency and idempotency gate"
          : "Clean Architecture skeleton",
  }));
}

function createWorkItem(body) {
  if (!body.title || !body.owner) {
    throw new Error("Work item requires title and owner");
  }

  const nextNumber = String(state.workItems.length + 1).padStart(3, "0");
  return {
    id: body.id ?? `OUNJAI-${nextNumber}`,
    title: body.title,
    owner: body.owner,
    priority: body.priority ?? "medium",
    state: body.state ?? "queued",
    service: body.service ?? "unassigned",
    acceptanceGate: body.acceptanceGate ?? "Acceptance gate pending",
    updatedAt: currentTime(),
  };
}

function findAgentRun(id) {
  return state.agentRuns.find((run) => run.id === id || run.agentId === id);
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

function simulateAgentWork() {
  const run = state.agentRuns[tickIndex % state.agentRuns.length];
  tickIndex += 1;

  if (!run || run.status === "blocked") {
    return;
  }

  run.status = run.status === "idle" ? "working" : run.status;
  run.progress = clamp(run.progress + 3);
  run.health = clamp(run.health + (run.progress % 2 === 0 ? 1 : -1));
  run.lastSignal = `Heartbeat at ${currentTime()} (${run.progress}% progress)`;

  const service = state.serviceReadiness[tickIndex % state.serviceReadiness.length];
  if (service) {
    service.readiness = clamp(service.readiness + 1);
  }

  if (run.progress >= 100) {
    run.status = "review";
    run.progress = 92;
    addEvent({
      agent: run.agentName,
      type: "handoff",
      message: `${run.agentName} moved current task to review.`,
    });
  }
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
