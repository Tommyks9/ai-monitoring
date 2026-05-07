"use client";

import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import type { TaskPriority } from "@/lib/monitoring-types";

type SubmitState =
  | {
      kind: "idle";
      message: string;
    }
  | {
      kind: "success" | "error";
      message: string;
    };

const priorities: TaskPriority[] = ["critical", "high", "medium", "low"];

export function TaskCreator({
  owners,
  services,
  runtimeConnected,
  runtimeDetail,
}: {
  owners: string[];
  services: string[];
  runtimeConnected: boolean;
  runtimeDetail: string;
}) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState(owners[0] ?? "");
  const [priority, setPriority] = useState<TaskPriority>("high");
  const [service, setService] = useState(services[0] ?? "all services");
  const [acceptanceGate, setAcceptanceGate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({
    kind: "idle",
    message: runtimeConnected
      ? "Create a task and it will appear in the runtime queue."
      : "Start npm run runtime and set AGENT_RUNTIME_URL to create live tasks.",
  });

  const canSubmit = useMemo(
    () => runtimeConnected && title.trim().length > 0 && owner && service,
    [owner, runtimeConnected, service, title],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitState({ kind: "idle", message: "Sending task to Agent Runtime..." });

    try {
      const response = await fetch("/api/runtime/work-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          owner,
          priority,
          service,
          acceptanceGate: acceptanceGate.trim() || "Acceptance gate pending",
        }),
      });
      const data = (await response.json()) as { id?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? `Runtime returned ${response.status}`);
      }

      setTitle("");
      setAcceptanceGate("");
      setSubmitState({
        kind: "success",
        message: `Created ${data.id ?? "new work item"}. Refreshing dashboard...`,
      });
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create work item";
      setSubmitState({ kind: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 rounded-3xl border border-sky-400/20 bg-sky-400/10 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-white">
            <Send className="h-4 w-4 text-sky-200" />
            <h3 className="font-semibold">Create work item</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Send a task to {runtimeConnected ? runtimeDetail : "the Agent Runtime"} and monitor the queue below.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs ${
            runtimeConnected ? "bg-emerald-400/15 text-emerald-200" : "bg-rose-400/15 text-rose-200"
          }`}
        >
          {runtimeConnected ? "runtime ready" : "runtime offline"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <label className="text-sm text-slate-300">
          Task title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Generate identity-service skeleton"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none ring-sky-400/0 transition focus:ring-2"
          />
        </label>

        <label className="text-sm text-slate-300">
          Owner agent
          <select
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none ring-sky-400/0 transition focus:ring-2"
          >
            {owners.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Service
          <select
            value={service}
            onChange={(event) => setService(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none ring-sky-400/0 transition focus:ring-2"
          >
            {services.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Priority
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as TaskPriority)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none ring-sky-400/0 transition focus:ring-2"
          >
            {priorities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 block text-sm text-slate-300">
        Acceptance gate
        <textarea
          value={acceptanceGate}
          onChange={(event) => setAcceptanceGate(event.target.value)}
          placeholder="Clean Architecture layers exist and tests pass"
          rows={3}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none ring-sky-400/0 transition focus:ring-2"
        />
      </label>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          className={`text-sm ${
            submitState.kind === "success"
              ? "text-emerald-200"
              : submitState.kind === "error"
                ? "text-rose-200"
                : "text-slate-400"
          }`}
        >
          {submitState.message}
        </p>
        <button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="rounded-2xl bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
        >
          {isSubmitting ? "Sending..." : "Send to agent queue"}
        </button>
      </div>
    </form>
  );
}
