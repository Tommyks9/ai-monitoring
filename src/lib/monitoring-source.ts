import { buildTeamMetrics, createMockSnapshot, operatingSteps } from "./monitoring-data";
import type { AgentEvent, AgentRun, MonitoringSnapshot, ServiceReadiness, WorkItem } from "./monitoring-types";

const runtimeUrl = process.env.AGENT_RUNTIME_URL;
const runtimeToken = process.env.AGENT_RUNTIME_TOKEN;

function cleanBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function publicRuntimeLabel(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return "runtime ที่ตั้งค่าไว้";
  }
}

async function fetchRuntimeJson<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    cache: "no-store",
    headers: runtimeToken
      ? {
          Authorization: `Bearer ${runtimeToken}`,
        }
      : undefined,
  });

  if (!response.ok) {
    throw new Error(`${path} ตอบกลับด้วยสถานะ ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getMonitoringSnapshot(): Promise<MonitoringSnapshot> {
  if (!runtimeUrl) {
    return createMockSnapshot();
  }

  const baseUrl = cleanBaseUrl(runtimeUrl);

  try {
    const [agentRuns, workItems, agentEvents, serviceReadiness] = await Promise.all([
      fetchRuntimeJson<AgentRun[]>(baseUrl, "/api/agents"),
      fetchRuntimeJson<WorkItem[]>(baseUrl, "/api/work-items"),
      fetchRuntimeJson<AgentEvent[]>(baseUrl, "/api/events"),
      fetchRuntimeJson<ServiceReadiness[]>(baseUrl, "/api/services/readiness"),
    ]);

    return {
      source: {
        mode: "remote",
        label: "Agent Runtime ที่เชื่อมต่ออยู่",
        detail: publicRuntimeLabel(baseUrl),
        lastUpdated: new Date().toISOString(),
      },
      agentRuns,
      workItems,
      agentEvents,
      serviceReadiness,
      teamMetrics: buildTeamMetrics(agentRuns, workItems),
      operatingSteps,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่ทราบสาเหตุ";
    return createMockSnapshot(`Agent Runtime ยังใช้งานไม่ได้ (${message}) กำลังแสดงข้อมูลจำลองแทน`);
  }
}
