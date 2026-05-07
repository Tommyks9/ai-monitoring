export type AgentStatus = "working" | "review" | "idle" | "blocked";

export type TaskPriority = "critical" | "high" | "medium" | "low";

export type TaskState = "queued" | "in_progress" | "review" | "blocked" | "done";

export type AgentRun = {
  id: string;
  agentId: string;
  agentName: string;
  team: string;
  status: AgentStatus;
  currentTask: string;
  health: number;
  progress: number;
  queueDepth: number;
  lastSignal: string;
  risk: string;
};

export type WorkItem = {
  id: string;
  title: string;
  owner: string;
  priority: TaskPriority;
  state: TaskState;
  service: string;
  acceptanceGate: string;
  updatedAt: string;
};

export type AgentEvent = {
  id: string;
  time: string;
  agent: string;
  type: "handoff" | "decision" | "test" | "blocker" | "deploy";
  message: string;
};

export type ServiceReadiness = {
  name: string;
  port: number;
  database: string;
  coreLogic: string;
  owner: string;
  readiness: number;
  nextGate: string;
};

export type TeamMetric = {
  label: string;
  value: string;
  helper: string;
  tone: "sky" | "emerald" | "amber" | "rose" | "violet";
};
