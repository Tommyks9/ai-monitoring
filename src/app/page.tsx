import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const agents = [
  { id: 1, name: "Data Collector", status: "active", tasks: 142, uptime: "99.8%" },
  { id: 2, name: "Report Generator", status: "active", tasks: 87, uptime: "99.5%" },
  { id: 3, name: "Alert Monitor", status: "idle", tasks: 23, uptime: "98.2%" },
  { id: 4, name: "Log Analyzer", status: "error", tasks: 0, uptime: "45.1%" },
];

function StatusBadge({ status }: { status: string }) {
  const variant = status === "active" ? "default" : status === "idle" ? "secondary" : "destructive";
  return <Badge variant={variant}>{status}</Badge>;
}

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          AI Agent Monitoring
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Virtual Workspace for AI Agents
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Total Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{agents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {agents.filter((a) => a.status === "active").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Idle</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">
              {agents.filter((a) => a.status === "idle").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {agents.filter((a) => a.status === "error").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium text-zinc-500">Name</th>
                  <th className="pb-3 font-medium text-zinc-500">Status</th>
                  <th className="pb-3 font-medium text-zinc-500">Tasks Completed</th>
                  <th className="pb-3 font-medium text-zinc-500">Uptime</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{agent.name}</td>
                    <td className="py-3">
                      <StatusBadge status={agent.status} />
                    </td>
                    <td className="py-3">{agent.tasks}</td>
                    <td className="py-3">{agent.uptime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
