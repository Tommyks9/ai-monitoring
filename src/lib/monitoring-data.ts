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
    currentTask: "Lock trip/payment saga boundaries and gateway contracts",
    health: 92,
    progress: 78,
    queueDepth: 2,
    lastSignal: "ADR draft ready for payment outbox and trip state machine",
    risk: "Needs QA sign-off for duplicate booking prevention",
  },
  {
    id: "run-shared-lib-001",
    agentId: "shared-lib-agent",
    agentName: agentNameById.get("shared-lib-agent") ?? "Shared Lib Agent",
    team: teamByAgent.get("shared-lib-agent") ?? "Strategy & Blueprint",
    status: "working",
    currentTask: "Prepare /libs/common contract package for proto, logger and exception filter",
    health: 88,
    progress: 64,
    queueDepth: 3,
    lastSignal: "Common DTO export policy defined",
    risk: "Proto versioning convention still open",
  },
  {
    id: "run-lead-dev-001",
    agentId: "lead-developer-agent",
    agentName: agentNameById.get("lead-developer-agent") ?? "Lead Developer Agent",
    team: teamByAgent.get("lead-developer-agent") ?? "Development Backend",
    status: "working",
    currentTask: "Generate NestJS service skeletons from system-blueprint.json",
    health: 84,
    progress: 52,
    queueDepth: 9,
    lastSignal: "Service-to-port map imported from blueprint",
    risk: "CLI tmg-b adapter not wired to orchestration runtime yet",
  },
  {
    id: "run-db-001",
    agentId: "database-engineer-agent",
    agentName: agentNameById.get("database-engineer-agent") ?? "Database Engineer Agent",
    team: teamByAgent.get("database-engineer-agent") ?? "Development Backend",
    status: "blocked",
    currentTask: "Design location 2dsphere index and trip consistency model",
    health: 71,
    progress: 41,
    queueDepth: 4,
    lastSignal: "Waiting for final trip state names from Architect Agent",
    risk: "Trip/payment consistency cannot be validated without final state machine",
  },
  {
    id: "run-frontend-001",
    agentId: "frontend-agent",
    agentName: agentNameById.get("frontend-agent") ?? "Frontend Agent",
    team: teamByAgent.get("frontend-agent") ?? "Development Frontend",
    status: "idle",
    currentTask: "Prepare admin dashboard and mobile flow once gateway contracts are ready",
    health: 86,
    progress: 26,
    queueDepth: 5,
    lastSignal: "Dashboard shell can start from mock OpenAPI schema",
    risk: "Needs gateway schema before typed client generation",
  },
  {
    id: "run-qa-001",
    agentId: "qa-automation-agent",
    agentName: agentNameById.get("qa-automation-agent") ?? "QA Automation Agent",
    team: teamByAgent.get("qa-automation-agent") ?? "Quality & Docs",
    status: "review",
    currentTask: "Draft acceptance matrix for trip booking and payment flows",
    health: 90,
    progress: 58,
    queueDepth: 6,
    lastSignal: "Critical path tests identified",
    risk: "Needs concrete business user stories for full acceptance mapping",
  },
  {
    id: "run-docs-001",
    agentId: "documentation-agent",
    agentName: agentNameById.get("documentation-agent") ?? "Documentation Agent",
    team: teamByAgent.get("documentation-agent") ?? "Quality & Docs",
    status: "working",
    currentTask: "Create service README template and gRPC sequence diagram backlog",
    health: 94,
    progress: 70,
    queueDepth: 4,
    lastSignal: "Documentation gates linked to agent operating model",
    risk: "Swagger/Postman generation awaits gateway implementation",
  },
];

export const workItems: WorkItem[] = [
  {
    id: "OUNJAI-001",
    title: "Create /libs/common foundation",
    owner: "Shared Lib Agent",
    priority: "critical",
    state: "in_progress",
    service: "/libs/common",
    acceptanceGate: "No duplicated DTO/logger/exception code in services",
    updatedAt: "08:51 UTC",
  },
  {
    id: "OUNJAI-002",
    title: "Generate 9 NestJS service skeletons",
    owner: "Lead Developer Agent",
    priority: "critical",
    state: "queued",
    service: "all services",
    acceptanceGate: "Ports 60051-60059 match blueprint",
    updatedAt: "08:46 UTC",
  },
  {
    id: "OUNJAI-003",
    title: "Design location tracking schema",
    owner: "Database Engineer Agent",
    priority: "high",
    state: "blocked",
    service: "location-service",
    acceptanceGate: "2dsphere index and stale-location policy documented",
    updatedAt: "08:42 UTC",
  },
  {
    id: "OUNJAI-004",
    title: "Build trip/payment acceptance matrix",
    owner: "QA Automation Agent",
    priority: "high",
    state: "review",
    service: "trip-service, payment-service",
    acceptanceGate: "Duplicate charge and duplicate booking tests listed",
    updatedAt: "08:39 UTC",
  },
  {
    id: "OUNJAI-005",
    title: "Prepare gateway documentation pipeline",
    owner: "Documentation Agent",
    priority: "medium",
    state: "in_progress",
    service: "admin-gateway, mobile-gateway",
    acceptanceGate: "Swagger/Postman and sequence diagram templates ready",
    updatedAt: "08:35 UTC",
  },
];

export const agentEvents: AgentEvent[] = [
  {
    id: "evt-001",
    time: "08:55",
    agent: "Architect Agent",
    type: "decision",
    message: "Selected Saga + Transaction Outbox as the default trip/payment consistency pattern.",
  },
  {
    id: "evt-002",
    time: "08:52",
    agent: "Shared Lib Agent",
    type: "handoff",
    message: "Published shared contract boundary for proto, DTO, logger and exception modules.",
  },
  {
    id: "evt-003",
    time: "08:48",
    agent: "Database Engineer Agent",
    type: "blocker",
    message: "Paused trip schema finalization until booking state machine names are locked.",
  },
  {
    id: "evt-004",
    time: "08:44",
    agent: "QA Automation Agent",
    type: "test",
    message: "Added pending regression gates for duplicate booking, duplicate charge and timeout retry.",
  },
  {
    id: "evt-005",
    time: "08:40",
    agent: "Documentation Agent",
    type: "handoff",
    message: "Queued service README and Mermaid sequence diagram templates for all critical flows.",
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
      ? "2dsphere index plan"
      : service.name === "trip-service" || service.name === "payment-service"
        ? "consistency and idempotency gate"
        : "Clean Architecture skeleton",
}));

export function buildTeamMetrics(runs: AgentRun[], items: WorkItem[]): TeamMetric[] {
  const averageHealth = runs.length
    ? Math.round(runs.reduce((sum, agent) => sum + agent.health, 0) / runs.length)
    : 0;

  return [
    {
      label: "Agents Online",
      value: `${runs.length}/${agentRegistry.agents.length}`,
      helper: "All roles registered in the OunJai model",
      tone: "emerald",
    },
    {
      label: "Active Work",
      value: `${items.filter((item) => item.state === "in_progress").length}`,
      helper: "Tasks currently being executed",
      tone: "sky",
    },
    {
      label: "Blocked",
      value: `${items.filter((item) => item.state === "blocked").length}`,
      helper: "Needs Architect or product decision",
      tone: "rose",
    },
    {
      label: "Avg Health",
      value: `${averageHealth}%`,
      helper: "Signal quality from current run state",
      tone: "violet",
    },
  ];
}

export const teamMetrics: TeamMetric[] = buildTeamMetrics(agentRuns, workItems);

export const operatingSteps = [
  "Intake: convert business goal into Agent Task Brief",
  "Blueprint: Architect Agent locks contracts and boundaries",
  "Build: Shared Lib, Lead Dev, DB and Frontend agents execute in parallel",
  "Quality: QA validates critical paths and Documentation publishes handoff",
  "Monitor: dashboard tracks health, blockers, task state, events and readiness",
];

export function createMockSnapshot(detail = "Set AGENT_RUNTIME_URL to connect this local dashboard to remote agents."): MonitoringSnapshot {
  return {
    source: {
      mode: "mock",
      label: "Mock workspace data",
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
