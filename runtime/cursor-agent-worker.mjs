import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

loadLocalEnv();

const port = Number(process.env.AGENT_WORKER_PORT ?? 5050);
const runnerToken = process.env.AGENT_RUNNER_TOKEN ?? "";
const runtimeToken = process.env.AGENT_RUNTIME_TOKEN ?? "";
const providerName = process.env.AGENT_WORKER_PROVIDER ?? "Cursor Agent";
const providerSlug = process.env.AGENT_WORKER_PROVIDER_SLUG ?? "cursor-agent";
const agentCommand = process.env.AGENT_WORKER_COMMAND ?? process.env.CURSOR_AGENT_COMMAND ?? "";
const agentApiUrl = process.env.AGENT_WORKER_API_URL ?? "";
const agentApiKey = process.env.AGENT_WORKER_API_KEY ?? "";
const agentModel = process.env.AGENT_WORKER_MODEL ?? "";
const agentTimeoutMs = Number(process.env.AGENT_WORKER_TIMEOUT_MS ?? process.env.CURSOR_AGENT_TIMEOUT_MS ?? 600000);
const autoComplete = process.env.AGENT_WORKER_AUTO_COMPLETE ?? process.env.CURSOR_AGENT_AUTO_COMPLETE ?? "true";
const shouldAutoComplete = autoComplete !== "false";
const workerMode = agentCommand ? `${providerSlug}-command` : agentApiUrl ? `${providerSlug}-api` : "thai-fallback";
const runsDir = join(rootDir, ".agent-runs");

mkdirSync(runsDir, { recursive: true });

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

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      sendJson(response, 200, {
        name: `OunJai ${providerName} Worker`,
        status: "ok",
        mode: workerMode,
        command: agentCommand ? "configured" : "not_configured",
        apiUrl: agentApiUrl ? "configured" : "not_configured",
        port,
      });
      return;
    }

    if (request.method === "POST" && (url.pathname === "/agent-dispatch" || url.pathname === "/dispatch")) {
      const payload = await readJsonBody(request);
      const workItemId = payload?.workItem?.id;

      if (!workItemId || !payload?.agent?.id) {
        sendJson(response, 400, { error: "payload ต้องมี workItem.id และ agent.id" });
        return;
      }

      runWorkItem(payload).catch((error) => {
        const message = error instanceof Error ? error.message : "ไม่ทราบสาเหตุ";
        console.error(`งาน ${workItemId} ล้มเหลว: ${message}`);
      });

      sendJson(response, 202, {
        accepted: true,
        mode: workerMode,
        workItemId,
        message:
          agentCommand || agentApiUrl
            ? `รับงานแล้ว กำลังส่งต่อให้ ${providerName}`
            : `รับงานแล้ว แต่ยังไม่ได้ตั้ง command/API ของ ${providerName} จึงใช้โหมด fallback ภาษาไทย`,
      });
      return;
    }

    sendJson(response, 404, { error: "ไม่พบ route นี้" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิด worker error ที่ไม่ทราบสาเหตุ";
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, () => {
  console.log(`OunJai ${providerName} Worker พร้อมใช้งานที่ http://localhost:${port}`);
  console.log(
    agentCommand
      ? `ตั้งค่า command ของ ${providerName} แล้ว`
      : agentApiUrl
        ? `ตั้งค่า API URL ของ ${providerName} แล้ว`
        : `ยังไม่ได้ตั้ง command/API ของ ${providerName}: ใช้ fallback ภาษาไทย`,
  );
});

async function runWorkItem(payload) {
  const workItem = payload.workItem;
  const agent = payload.agent;
  const callbackBaseUrl = cleanBaseUrl(payload.runtime?.callbackBaseUrl ?? process.env.AGENT_RUNTIME_URL ?? "http://localhost:4000");
  const endpoints = payload.callbackEndpoints ?? {};
  const runDir = join(runsDir, sanitizeFileName(workItem.id));
  mkdirSync(runDir, { recursive: true });

  const prompt = buildCursorAgentPrompt(payload);
  const promptFile = join(runDir, "prompt.md");
  const outputFile = join(runDir, "output.md");
  writeFileSync(promptFile, prompt);

  await postCallback(callbackBaseUrl, endpoints.heartbeat, {
    workItemId: workItem.id,
    status: "working",
    progress: 15,
    lastSignal: `${agent.name} รับงาน ${workItem.id} แล้ว และกำลังเตรียม prompt สำหรับ ${providerName}`,
  });

  const result = agentCommand
    ? await executeAgentCommand({ payload, prompt, promptFile, outputFile, runDir })
    : agentApiUrl
      ? await executeAgentApi({ payload, prompt, outputFile })
      : await runThaiFallbackAgent({ payload, outputFile });

  await postCallback(callbackBaseUrl, endpoints.heartbeat, {
    workItemId: workItem.id,
    status: result.ok ? "review" : "blocked",
    progress: result.ok ? 100 : 80,
    lastSignal: result.ok
      ? `${agent.name} ทำงาน ${workItem.id} เสร็จแล้วและส่ง handoff ภาษาไทยกลับ runtime`
      : `${agent.name} ทำงาน ${workItem.id} ไม่สำเร็จ: ${result.summary}`,
  });

  await postCallback(callbackBaseUrl, endpoints.events, {
    workItemId: workItem.id,
    type: result.ok ? "handoff" : "blocker",
    status: result.ok ? "review" : "blocked",
    progress: result.ok ? 100 : 80,
    message: result.summary,
    handoff: result.handoff,
    lastSignal: result.summary,
  });

  if (shouldAutoComplete && result.ok) {
    await postCallback(callbackBaseUrl, endpoints.state, {
      state: "done",
      agent: agent.name,
      handoff: result.handoff,
      note: `${workItem.id} ปิดงานโดย ${providerName} Worker แล้ว`,
      lastSignal: result.summary,
    }, "PATCH");
  }
}

async function executeAgentCommand({ payload, prompt, promptFile, outputFile, runDir }) {
  const command = renderCommand(agentCommand, {
    promptFile,
    outputFile,
    workItemId: payload.workItem.id,
    agentId: payload.agent.id,
  });
  const cwd = resolve(rootDir, process.env.AGENT_WORKER_WORKDIR ?? process.env.CURSOR_AGENT_WORKDIR ?? ".");

  const execution = await runShellCommand(command, {
    cwd,
    input: command.includes(shellQuote(promptFile)) || command.includes(promptFile) ? "" : prompt,
    timeoutMs: agentTimeoutMs,
    env: {
      OUNJAI_WORK_ITEM_ID: payload.workItem.id,
      OUNJAI_AGENT_ID: payload.agent.id,
      OUNJAI_PROMPT_FILE: promptFile,
      OUNJAI_OUTPUT_FILE: outputFile,
      OUNJAI_AGENT_PROVIDER: providerName,
    },
  });

  const output = [execution.stdout, execution.stderr].filter(Boolean).join("\n\n").trim();
  const storedOutput = output || `${providerName} command ทำงานเสร็จแล้วแต่ไม่มี output`;
  writeFileSync(outputFile, storedOutput);

  if (execution.code !== 0) {
    return {
      ok: false,
      summary: `${providerName} command ล้มเหลวด้วย exit code ${execution.code}`,
      handoff: storedOutput.slice(0, 4000),
    };
  }

  return {
    ok: true,
    summary: `${providerName} ทำงาน ${payload.workItem.id} เสร็จแล้ว`,
    handoff: [
      `## Handoff ภาษาไทยจาก ${payload.agent.name}`,
      "",
      `### งาน`,
      `- ${payload.workItem.id}: ${payload.workItem.title}`,
      "",
      `### ผลลัพธ์จาก ${providerName}`,
      storedOutput.slice(0, 6000),
    ].join("\n"),
  };
}

async function executeAgentApi({ payload, prompt, outputFile }) {
  const response = await fetch(agentApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(agentApiKey ? { Authorization: `Bearer ${agentApiKey}` } : {}),
    },
    body: JSON.stringify({
      provider: providerSlug,
      model: agentModel || undefined,
      prompt,
      agent: payload.agent,
      workItem: payload.workItem,
      sourceOfTruth: payload.sourceOfTruth,
      communication: payload.communication,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error ?? data.message ?? `${providerName} API ตอบกลับด้วยสถานะ ${response.status}`;
    return {
      ok: false,
      summary: message,
      handoff: JSON.stringify(data, null, 2).slice(0, 4000),
    };
  }

  const output =
    data.handoff ??
    data.output ??
    data.content ??
    data.message ??
    data.result ??
    `${providerName} API ทำงานเสร็จแล้วแต่ไม่ได้ส่ง output กลับมา`;
  writeFileSync(outputFile, String(output));

  return {
    ok: true,
    summary: `${providerName} API ทำงาน ${payload.workItem.id} เสร็จแล้ว`,
    handoff: [
      `## Handoff ภาษาไทยจาก ${payload.agent.name}`,
      "",
      `### งาน`,
      `- ${payload.workItem.id}: ${payload.workItem.title}`,
      "",
      `### ผลลัพธ์จาก ${providerName} API`,
      String(output).slice(0, 6000),
    ].join("\n"),
  };
}

async function runThaiFallbackAgent({ payload, outputFile }) {
  const handoff = [
    `## Handoff จำลองภาษาไทยจาก ${payload.agent.name}`,
    "",
    `> หมายเหตุ: ยังไม่ได้ตั้ง command/API ของ ${providerName} จึงยังไม่ได้เรียก agent worker จริง`,
    "",
    `### งาน`,
    `- รหัสงาน: ${payload.workItem.id}`,
    `- ชื่องาน: ${payload.workItem.title}`,
    `- ขอบเขต: ${payload.workItem.service}`,
    "",
    `### เกณฑ์ผ่านงาน`,
    `- ${payload.workItem.acceptanceGate}`,
    "",
    `### คำแนะนำขั้นต่อไป`,
    `1. ตั้งค่า command หรือ API URL ของ ${providerName}`,
    `2. รัน worker อีกครั้ง`,
    `3. ส่งงานใหม่จาก dashboard เพื่อให้ worker เรียก ${providerName} จริง`,
  ].join("\n");
  writeFileSync(outputFile, handoff);

  return {
    ok: true,
    summary: `Fallback worker สร้าง handoff ภาษาไทยสำหรับงาน ${payload.workItem.id} แล้ว`,
    handoff,
  };
}

function buildCursorAgentPrompt(payload) {
  const { agent, workItem, communication, sourceOfTruth, callbackEndpoints, runtime } = payload;

  return [
    `# งานสำหรับ ${providerName}`,
    "",
    `คุณคือ ${agent.name} ในทีม OunJai AI Software House`,
    "",
    `## นโยบายภาษา`,
    communication?.policy ??
      "ตอบกลับและส่ง handoff/progress/error เป็นภาษาไทยก่อนเสมอ ยกเว้นชื่อไฟล์ โค้ด command endpoint และ identifier ทางเทคนิค",
    "",
    `## Prompt ประจำตำแหน่ง`,
    agent.prompt || "-",
    "",
    `## งานที่ได้รับ`,
    `- รหัสงาน: ${workItem.id}`,
    `- ชื่องาน: ${workItem.title}`,
    `- Service/Scope: ${workItem.service}`,
    `- Priority: ${workItem.priority}`,
    `- Acceptance Gate: ${workItem.acceptanceGate}`,
    "",
    `## Source of Truth`,
    `- systemBlueprint.version: ${sourceOfTruth?.systemBlueprint?.version ?? "-"}`,
    `- architecture: ${sourceOfTruth?.systemBlueprint?.architecture_pattern ?? "-"}`,
    `- global rules: ${(sourceOfTruth?.agentRegistry?.global_rules ?? []).join(" | ")}`,
    "",
    `## Callback กลับ Runtime`,
    `- baseUrl: ${runtime?.callbackBaseUrl ?? "-"}`,
    `- heartbeat: ${callbackEndpoints?.heartbeat ?? "-"}`,
    `- events: ${callbackEndpoints?.events ?? "-"}`,
    `- state: ${callbackEndpoints?.state ?? "-"}`,
    "",
    `## รูปแบบผลลัพธ์ที่ต้องส่งกลับ`,
    `ตอบเป็นภาษาไทย พร้อมหัวข้อ:`,
    `1. สรุปสิ่งที่ทำ`,
    `2. ไฟล์/ส่วนที่เกี่ยวข้อง`,
    `3. Validation หรือ test`,
    `4. ความเสี่ยง`,
    `5. Next action`,
  ].join("\n");
}

function runShellCommand(command, { cwd, input, timeoutMs, env }) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, {
      shell: true,
      cwd,
      env: {
        ...process.env,
        ...env,
      },
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      child.kill("SIGTERM");
      settled = true;
      resolvePromise({
        code: 124,
        stdout,
        stderr: `${stderr}\nหมดเวลารอ ${providerName} หลัง ${timeoutMs}ms`.trim(),
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      clearTimeout(timer);
      settled = true;
      resolvePromise({ code: code ?? 0, stdout, stderr });
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

async function postCallback(baseUrl, endpoint, payload, method = "POST") {
  if (!endpoint) {
    return;
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(runtimeToken ? { Authorization: `Bearer ${runtimeToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`callback ${endpoint} ตอบกลับด้วยสถานะ ${response.status}`);
  }
}

function renderCommand(template, replacements) {
  return Object.entries(replacements).reduce(
    (command, [key, value]) => command.replaceAll(`{${key}}`, shellQuote(String(value))),
    template,
  );
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
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
  if (!runnerToken) {
    return true;
  }

  return request.headers.authorization === `Bearer ${runnerToken}`;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", process.env.AGENT_WORKER_CORS_ORIGIN ?? "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function cleanBaseUrl(url) {
  return url.replace(/\/+$/, "");
}

function sanitizeFileName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, "_");
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
