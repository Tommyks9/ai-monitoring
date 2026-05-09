import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  RadioTower,
  Workflow,
} from "lucide-react";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { TaskCreator } from "@/components/dashboard/task-creator";
import { getMonitoringSnapshot } from "@/lib/monitoring-source";
import type { AgentStatus, TaskPriority, TaskState, TeamMetric } from "@/lib/monitoring-types";

export const dynamic = "force-dynamic";

const statusStyles: Record<AgentStatus, string> = {
  working: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  review: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  idle: "border-slate-400/40 bg-slate-400/10 text-slate-200",
  blocked: "border-rose-400/40 bg-rose-400/10 text-rose-200",
};

const taskStateStyles: Record<TaskState, string> = {
  queued: "bg-slate-500/15 text-slate-200",
  in_progress: "bg-emerald-500/15 text-emerald-200",
  review: "bg-sky-500/15 text-sky-200",
  blocked: "bg-rose-500/15 text-rose-200",
  done: "bg-violet-500/15 text-violet-200",
};

const priorityStyles: Record<TaskPriority, string> = {
  critical: "text-rose-200",
  high: "text-amber-200",
  medium: "text-sky-200",
  low: "text-slate-200",
};

const statusLabels: Record<AgentStatus, string> = {
  working: "กำลังทำงาน",
  review: "รอตรวจ",
  idle: "ว่าง",
  blocked: "ติดขัด",
};

const taskStateLabels: Record<TaskState, string> = {
  queued: "รอคิว",
  in_progress: "กำลังทำ",
  review: "รอตรวจ",
  blocked: "ติดขัด",
  done: "เสร็จแล้ว",
};

const priorityLabels: Record<TaskPriority, string> = {
  critical: "วิกฤต",
  high: "สูง",
  medium: "กลาง",
  low: "ต่ำ",
};

const dispatchStatusLabels: Record<string, string> = {
  waiting: "รอจัดงาน",
  assigned: "มอบหมายแล้ว",
  sent_to_agent: "ส่งให้ agent แล้ว",
  running: "กำลังรัน",
  review: "รอตรวจ",
  completed: "เสร็จสมบูรณ์",
  blocked: "ติดขัด",
};

const dispatchModeLabels: Record<string, string> = {
  local: "จำลองในเครื่อง",
  webhook: "ส่งไป runner จริง",
  hybrid: "ผสม",
};

const metricStyles: Record<TeamMetric["tone"], string> = {
  sky: "from-sky-500/30 to-cyan-500/10 ring-sky-400/20",
  emerald: "from-emerald-500/30 to-teal-500/10 ring-emerald-400/20",
  amber: "from-amber-500/30 to-orange-500/10 ring-amber-400/20",
  rose: "from-rose-500/30 to-pink-500/10 ring-rose-400/20",
  violet: "from-violet-500/30 to-fuchsia-500/10 ring-violet-400/20",
};

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300/80">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-300"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export default async function Home() {
  const {
    source,
    agentRuns,
    workItems,
    agentEvents,
    serviceReadiness,
    teamMetrics,
    operatingSteps,
  } = await getMonitoringSnapshot();
  const blockedItems = workItems.filter((item) => item.state === "blocked");
  const criticalItems = workItems.filter((item) => item.priority === "critical");
  const ownerOptions = agentRuns.map((agent) => agent.agentName);
  const serviceOptions = ["ทุก service", "/libs/common", ...serviceReadiness.map((service) => service.name)];

  return (
    <main className="min-h-screen px-6 py-8 sm:px-10 lg:px-12">
      <AutoRefresh intervalSeconds={20} />
      <section className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-sky-950/40">
          <div className="border-b border-white/10 px-6 py-5 sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-100">
                  <RadioTower className="h-3.5 w-3.5" />
                  {source.mode === "remote" ? "เชื่อมต่อ Agent Runtime แล้ว" : "กำลังใช้ข้อมูลจำลองในเครื่อง"}
                </div>
                <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  ศูนย์ควบคุมทีม AI Agents อุ่นใจ
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
                  ติดตามสุขภาพทีม งานที่แต่ละ agent รับผิดชอบ งานติดขัด การส่งมอบงาน และความพร้อมของ service ทั้งหมดจากหน้าเดียว
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
                <div className="flex items-center gap-2 text-white">
                  <LayoutDashboard className="h-4 w-4 text-emerald-300" />
                  แหล่งข้อมูล
                </div>
                <p className="mt-2 max-w-xs">
                  {source.label}: {source.detail}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  อัปเดตล่าสุด: {new Date(source.lastUpdated).toLocaleString("th-TH")}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4 sm:px-8">
            {teamMetrics.map((metric) => (
              <article
                key={metric.label}
                className={`rounded-3xl bg-gradient-to-br p-5 ring-1 ${metricStyles[metric.tone]}`}
              >
                <p className="text-sm text-slate-300">{metric.label}</p>
                <p className="mt-3 text-4xl font-semibold text-white">{metric.value}</p>
                <p className="mt-3 text-xs leading-5 text-slate-300">{metric.helper}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <SectionHeader
              eyebrow="ภาพรวมทีม"
              title="สถานะการทำงานของ Agents"
              description="แต่ละการ์ดแสดง agent จาก registry พร้อมงานปัจจุบัน สุขภาพ ความคืบหน้า และความเสี่ยงที่ต้องดูแล"
            />
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {agentRuns.map((agent) => (
                <article key={agent.id} className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-sky-300" />
                        <h3 className="font-semibold text-white">{agent.agentName}</h3>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{agent.team}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs ${statusStyles[agent.status]}`}>
                      {statusLabels[agent.status]}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-200">{agent.currentTask}</p>
                  <div className="mt-5 grid grid-cols-3 gap-3 text-xs text-slate-300">
                    <div className="rounded-2xl bg-white/5 p-3">
                      <p className="text-slate-500">สุขภาพ</p>
                      <p className="mt-1 text-lg font-semibold text-white">{agent.health}%</p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-3">
                      <p className="text-slate-500">คิว</p>
                      <p className="mt-1 text-lg font-semibold text-white">{agent.queueDepth}</p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-3">
                      <p className="text-slate-500">คืบหน้า</p>
                      <p className="mt-1 text-lg font-semibold text-white">{agent.progress}%</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <ProgressBar value={agent.progress} />
                  </div>
                  <div className="mt-4 rounded-2xl bg-white/5 p-3 text-xs leading-5 text-slate-300">
                    <p>
                      <span className="text-emerald-200">สัญญาณ:</span> {agent.lastSignal}
                    </p>
                    <p className="mt-1">
                      <span className="text-amber-200">ความเสี่ยง:</span> {agent.risk}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-8">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <SectionHeader
                eyebrow="วงจรควบคุมงาน"
                title="งานไหลผ่านทีมอย่างไร"
                description="รูปแบบการทำงานจะแปลงเป้าหมายธุรกิจให้กลายเป็นงานที่ agent รับไปทำและติดตามได้"
              />
              <ol className="mt-6 space-y-4">
                {operatingSteps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-400/15 text-sm font-semibold text-sky-200">
                      {index + 1}
                    </span>
                    <p className="pt-1 text-sm leading-6 text-slate-300">{step}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-center gap-2 text-white">
                <AlertTriangle className="h-5 w-5 text-rose-300" />
                <h2 className="text-xl font-semibold">งานติดขัด</h2>
              </div>
              <div className="mt-5 space-y-3">
                {blockedItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="mt-1 text-xs text-rose-100/80">{item.acceptanceGate}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <SectionHeader
            eyebrow="คิวปฏิบัติงาน"
            title="บอร์ดงานที่กำลังเดิน"
            description="ดูว่า agent ตัวไหนถือครองงานใด ต้องผ่าน gate อะไร และ dispatcher กำลังพางานผ่าน lifecycle ขั้นไหน"
          />
          <TaskCreator
            owners={ownerOptions}
            services={serviceOptions}
            runtimeConnected={source.mode === "remote"}
            runtimeDetail={source.detail}
          />
          <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
            <div className="grid grid-cols-12 gap-4 border-b border-white/10 bg-white/5 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span className="col-span-2">รหัสงาน</span>
              <span className="col-span-3">ชื่องาน</span>
              <span className="col-span-2">ผู้รับผิดชอบ</span>
              <span className="col-span-2">เกณฑ์ผ่านงาน</span>
              <span className="col-span-1">ความสำคัญ</span>
              <span className="col-span-2">สถานะ</span>
            </div>
            {workItems.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-12 gap-4 border-b border-white/5 px-5 py-4 text-sm text-slate-300 last:border-b-0"
              >
                <span className="col-span-2 font-mono text-sky-200">{item.id}</span>
                <span className="col-span-3">
                  <span className="text-white">{item.title}</span>
                  {typeof item.progress === "number" ? (
                    <span className="mt-2 block">
                      <ProgressBar value={item.progress} />
                      <span className="mt-1 block text-xs text-slate-500">ความคืบหน้า dispatch {item.progress}%</span>
                    </span>
                  ) : null}
                </span>
                <span className="col-span-2">{item.owner}</span>
                <span className="col-span-2 text-xs leading-5">
                  {item.acceptanceGate}
                  {item.lastSignal ? <span className="mt-1 block text-sky-200/80">{item.lastSignal}</span> : null}
                  {item.handoff ? <span className="mt-1 block text-emerald-200/80">{item.handoff}</span> : null}
                </span>
                <span className={`col-span-1 font-medium ${priorityStyles[item.priority]}`}>
                  {priorityLabels[item.priority]}
                </span>
                <span className="col-span-2">
                  <span className={`rounded-full px-3 py-1 text-xs ${taskStateStyles[item.state]}`}>
                    {taskStateLabels[item.state]}
                  </span>
                  {item.dispatchStatus ? (
                    <span className="mt-2 block text-xs text-slate-500">
                      dispatch: {dispatchStatusLabels[item.dispatchStatus] ?? item.dispatchStatus}
                    </span>
                  ) : null}
                  {item.dispatchMode ? (
                    <span className="mt-1 block text-xs text-slate-500">
                      โหมด: {dispatchModeLabels[item.dispatchMode] ?? item.dispatchMode}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-400">
            งานระดับวิกฤตตอนนี้: {criticalItems.length} งาน ระบบ dispatcher จะมอบหมายงาน ส่ง heartbeat ส่งงานไป webhook runner หากตั้งค่าไว้ และปิดงานหลังผ่าน review
          </p>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <SectionHeader
              eyebrow="เหตุการณ์ล่าสุด"
              title="Handoff และสัญญาณจากทีม"
            description="สตรีมเหตุการณ์คือแกนหลักของ monitoring: decision, blocker, test และ handoff note"
            />
            <div className="mt-6 space-y-4">
              {agentEvents.map((event) => (
                <article key={event.id} className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      {event.type === "test" ? (
                        <ListChecks className="h-4 w-4 text-emerald-300" />
                      ) : event.type === "blocker" ? (
                        <AlertTriangle className="h-4 w-4 text-rose-300" />
                      ) : event.type === "decision" ? (
                        <GitBranch className="h-4 w-4 text-violet-300" />
                      ) : (
                        <Workflow className="h-4 w-4 text-sky-300" />
                      )}
                      {event.agent}
                    </div>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock3 className="h-3.5 w-3.5" />
                      {event.time}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{event.message}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <SectionHeader
              eyebrow="ความพร้อมตาม Blueprint"
              title="แผนที่การสร้าง Microservices"
              description="ความพร้อมของ service อ้างอิงจาก system-blueprint.json เพื่อให้ monitor ตรงกับ master source เสมอ"
            />
            <div className="mt-6 grid gap-3">
              {serviceReadiness.map((service) => (
                <article key={service.name} className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {service.readiness >= 40 ? (
                          <Activity className="h-4 w-4 text-emerald-300" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-slate-400" />
                        )}
                        <h3 className="font-semibold text-white">{service.name}</h3>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        พอร์ต {service.port} / {service.database} / {service.coreLogic}
                      </p>
                    </div>
                    <div className="text-right text-sm text-slate-300">
                      <p className="text-white">พร้อม {service.readiness}%</p>
                      <p className="text-xs text-slate-400">{service.owner}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <ProgressBar value={service.readiness} />
                  </div>
                  <p className="mt-3 text-xs text-slate-400">gate ถัดไป: {service.nextGate}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
