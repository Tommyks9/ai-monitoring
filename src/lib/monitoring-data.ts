import agentRegistry from "../../blueprints/agent-registry.json";
import systemBlueprint from "../../blueprints/system-blueprint.json";
import type { AgentEvent, AgentRun, MonitoringSnapshot, ServiceReadiness, TeamMetric, WorkItem } from "./monitoring-types";

const teamByAgent = new Map(
  agentRegistry.teams.flatMap((team) => team.agents.map((agentId) => [agentId, team.name] as const)),
);

const agentNameById = new Map(agentRegistry.agents.map((agent) => [agent.id, agent.name] as const));

export const agentRuns: AgentRun[] = [
  {
    id: "run-architect-001",
    agentId: "architect-agent",
    agentName: agentNameById.get("architect-agent") ?? "Architect Agent",
    team: teamByAgent.get("architect-agent") ?? "Strategy & Blueprint",
    status: "review",
    currentTask: "ล็อกขอบเขต Saga ของ trip/payment และ contract ของ gateway",
    health: 92,
    progress: 78,
    queueDepth: 2,
    lastSignal: "ร่าง ADR สำหรับ payment outbox และ trip state machine พร้อมตรวจแล้ว",
    risk: "ต้องให้ QA ยืนยันเงื่อนไขป้องกันการจองซ้ำ",
  },
  {
    id: "run-shared-lib-001",
    agentId: "shared-lib-agent",
    agentName: agentNameById.get("shared-lib-agent") ?? "Shared Lib Agent",
    team: teamByAgent.get("shared-lib-agent") ?? "Strategy & Blueprint",
    status: "working",
    currentTask: "เตรียมแพ็กเกจ contract กลางใน /libs/common สำหรับ proto, logger และ exception filter",
    health: 88,
    progress: 64,
    queueDepth: 3,
    lastSignal: "กำหนดนโยบาย export Common DTO แล้ว",
    risk: "ยังต้องสรุปแนวทาง versioning ของ proto",
  },
  {
    id: "run-lead-dev-001",
    agentId: "lead-developer-agent",
    agentName: agentNameById.get("lead-developer-agent") ?? "Lead Developer Agent",
    team: teamByAgent.get("lead-developer-agent") ?? "Development Backend",
    status: "working",
    currentTask: "สร้างโครง NestJS services จาก system-blueprint.json",
    health: 84,
    progress: 52,
    queueDepth: 9,
    lastSignal: "นำ mapping service-to-port จาก blueprint เข้าระบบแล้ว",
    risk: "adapter ของ CLI tmg-b ยังไม่ได้ต่อกับ runtime orchestration",
  },
  {
    id: "run-db-001",
    agentId: "database-engineer-agent",
    agentName: agentNameById.get("database-engineer-agent") ?? "Database Engineer Agent",
    team: teamByAgent.get("database-engineer-agent") ?? "Development Backend",
    status: "blocked",
    currentTask: "ออกแบบ 2dsphere index ของ location และ consistency model ของ trip",
    health: 71,
    progress: 41,
    queueDepth: 4,
    lastSignal: "รอชื่อ state สุดท้ายของ trip จาก Architect Agent",
    risk: "ยังตรวจ consistency ของ trip/payment ไม่ได้จนกว่า state machine จะนิ่ง",
  },
  {
    id: "run-frontend-001",
    agentId: "frontend-agent",
    agentName: agentNameById.get("frontend-agent") ?? "Frontend Agent",
    team: teamByAgent.get("frontend-agent") ?? "Development Frontend",
    status: "idle",
    currentTask: "เตรียม dashboard admin และ flow mobile หลัง gateway contract พร้อม",
    health: 86,
    progress: 26,
    queueDepth: 5,
    lastSignal: "เริ่ม shell ของ dashboard จาก mock OpenAPI schema ได้แล้ว",
    risk: "ต้องมี gateway schema ก่อน generate typed client",
  },
  {
    id: "run-qa-001",
    agentId: "qa-automation-agent",
    agentName: agentNameById.get("qa-automation-agent") ?? "QA Automation Agent",
    team: teamByAgent.get("qa-automation-agent") ?? "Quality & Docs",
    status: "review",
    currentTask: "ร่าง acceptance matrix สำหรับ flow จองรถและชำระเงิน",
    health: 90,
    progress: 58,
    queueDepth: 6,
    lastSignal: "ระบุ critical path tests แล้ว",
    risk: "ต้องมี business user stories ที่ชัดเจนเพื่อ map acceptance ให้ครบ",
  },
  {
    id: "run-docs-001",
    agentId: "documentation-agent",
    agentName: agentNameById.get("documentation-agent") ?? "Documentation Agent",
    team: teamByAgent.get("documentation-agent") ?? "Quality & Docs",
    status: "working",
    currentTask: "สร้าง template README ราย service และ backlog sequence diagram ของ gRPC",
    health: 94,
    progress: 70,
    queueDepth: 4,
    lastSignal: "เชื่อม documentation gates กับ agent operating model แล้ว",
    risk: "การ generate Swagger/Postman รอ gateway implementation",
  },
];

export const workItems: WorkItem[] = [
  {
    id: "OUNJAI-001",
    title: "สร้าง foundation ของ /libs/common",
    owner: "Shared Lib Agent",
    priority: "critical",
    state: "in_progress",
    dispatchStatus: "running",
    service: "/libs/common",
    acceptanceGate: "ห้ามมี DTO/logger/exception code ซ้ำใน service ต่าง ๆ",
    dispatchMode: "local",
    progress: 64,
    lastSignal: "Shared Lib Agent กำลังสกัด common contracts",
    updatedAt: "08:51 UTC",
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
    updatedAt: "08:46 UTC",
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
    updatedAt: "08:42 UTC",
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
    updatedAt: "08:39 UTC",
  },
  {
    id: "OUNJAI-005",
    title: "เตรียม pipeline เอกสารสำหรับ gateway",
    owner: "Documentation Agent",
    priority: "medium",
    state: "in_progress",
    dispatchStatus: "running",
    service: "admin-gateway, mobile-gateway",
    acceptanceGate: "ต้องมี template Swagger/Postman และ sequence diagram พร้อมใช้",
    progress: 70,
    lastSignal: "Documentation Agent กำลังเตรียมเอกสาร gateway",
    updatedAt: "08:35 UTC",
  },
];

export const agentEvents: AgentEvent[] = [
  {
    id: "evt-001",
    time: "08:55",
    agent: "Architect Agent",
    type: "decision",
    message: "เลือก Saga + Transaction Outbox เป็น pattern หลักสำหรับ consistency ของ trip/payment",
  },
  {
    id: "evt-002",
    time: "08:52",
    agent: "Shared Lib Agent",
    type: "handoff",
    message: "เผยแพร่ขอบเขต shared contract สำหรับ proto, DTO, logger และ exception modules แล้ว",
  },
  {
    id: "evt-003",
    time: "08:48",
    agent: "Database Engineer Agent",
    type: "blocker",
    message: "พักการ finalize trip schema จนกว่าจะล็อกชื่อ booking state machine",
  },
  {
    id: "evt-004",
    time: "08:44",
    agent: "QA Automation Agent",
    type: "test",
    message: "เพิ่ม regression gates ที่ต้องตรวจสำหรับการจองซ้ำ ตัดเงินซ้ำ และ timeout retry แล้ว",
  },
  {
    id: "evt-005",
    time: "08:40",
    agent: "Documentation Agent",
    type: "handoff",
    message: "จัดคิว README ราย service และ Mermaid sequence diagram template สำหรับ critical flows แล้ว",
  },
];

export const serviceReadiness: ServiceReadiness[] = systemBlueprint.services.map((service, index) => ({
  name: service.name,
  port: service.port,
  database: service.db,
  coreLogic: service.core_logic,
  owner: index < 4 ? "Lead Developer Agent" : index < 7 ? "Database Engineer Agent" : "Documentation Agent",
  readiness: [42, 38, 46, 35, 33, 28, 30, 24, 26][index] ?? 25,
  nextGate:
    service.name === "location-service"
      ? "แผน 2dsphere index"
      : service.name === "trip-service" || service.name === "payment-service"
        ? "gate consistency และ idempotency"
        : "โครง Clean Architecture",
}));

export function buildTeamMetrics(runs: AgentRun[], items: WorkItem[]): TeamMetric[] {
  const averageHealth = runs.length
    ? Math.round(runs.reduce((sum, agent) => sum + agent.health, 0) / runs.length)
    : 0;

  return [
    {
      label: "Agents ออนไลน์",
      value: `${runs.length}/${agentRegistry.agents.length}`,
      helper: "ทุก role ถูก register ใน OunJai model",
      tone: "emerald",
    },
    {
      label: "งานที่กำลังทำ",
      value: `${items.filter((item) => item.state === "in_progress").length}`,
      helper: "จำนวนงานที่ agent กำลังดำเนินการ",
      tone: "sky",
    },
    {
      label: "ติดขัด",
      value: `${items.filter((item) => item.state === "blocked").length}`,
      helper: "ต้องการ decision จาก Architect หรือ product",
      tone: "rose",
    },
    {
      label: "สุขภาพเฉลี่ย",
      value: `${averageHealth}%`,
      helper: "คุณภาพสัญญาณจากสถานะ run ปัจจุบัน",
      tone: "violet",
    },
  ];
}

export const teamMetrics: TeamMetric[] = buildTeamMetrics(agentRuns, workItems);

export const operatingSteps = [
  "รับงาน: แปลงเป้าหมายธุรกิจเป็น Agent Task Brief",
  "Blueprint: Architect Agent ล็อก contract และ service boundary",
  "Build: Shared Lib, Lead Dev, DB และ Frontend ทำงานคู่ขนาน",
  "Quality: QA ตรวจ critical paths และ Documentation ส่งมอบ handoff",
  "Monitor: dashboard ติดตามสุขภาพ blocker สถานะงาน event และ readiness",
];

export function createMockSnapshot(detail = "ตั้งค่า AGENT_RUNTIME_URL เพื่อเชื่อม dashboard นี้กับ agents/runtime จริง"): MonitoringSnapshot {
  return {
    source: {
      mode: "mock",
      label: "ข้อมูลจำลองของ workspace",
      detail,
      lastUpdated: new Date().toISOString(),
    },
    agentRuns,
    workItems,
    agentEvents,
    serviceReadiness,
    teamMetrics,
    operatingSteps,
  };
}
