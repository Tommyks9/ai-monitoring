process.env.AGENT_WORKER_PROVIDER = process.env.AGENT_WORKER_PROVIDER ?? "OpenClaw";
process.env.AGENT_WORKER_PROVIDER_SLUG = process.env.AGENT_WORKER_PROVIDER_SLUG ?? "openclaw";
process.env.AGENT_WORKER_PORT = process.env.OPENCLAW_WORKER_PORT ?? process.env.AGENT_WORKER_PORT ?? "5055";
process.env.AGENT_WORKER_COMMAND = process.env.OPENCLAW_COMMAND ?? process.env.AGENT_WORKER_COMMAND ?? "";
process.env.AGENT_WORKER_API_URL = process.env.OPENCLAW_API_URL ?? process.env.AGENT_WORKER_API_URL ?? "";
process.env.AGENT_WORKER_API_KEY = process.env.OPENCLAW_API_KEY ?? process.env.AGENT_WORKER_API_KEY ?? "";
process.env.AGENT_WORKER_MODEL = process.env.OPENCLAW_MODEL ?? process.env.AGENT_WORKER_MODEL ?? "";
process.env.AGENT_WORKER_TIMEOUT_MS = process.env.OPENCLAW_TIMEOUT_MS ?? process.env.AGENT_WORKER_TIMEOUT_MS ?? "600000";
process.env.AGENT_WORKER_AUTO_COMPLETE =
  process.env.OPENCLAW_AUTO_COMPLETE ?? process.env.AGENT_WORKER_AUTO_COMPLETE ?? "true";

await import("./cursor-agent-worker.mjs");
