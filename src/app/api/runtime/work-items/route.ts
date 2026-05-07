import { NextResponse } from "next/server";

function cleanBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export async function POST(request: Request) {
  const runtimeUrl = process.env.AGENT_RUNTIME_URL;
  const runtimeToken = process.env.AGENT_RUNTIME_TOKEN;

  if (!runtimeUrl) {
    return NextResponse.json(
      {
        error: "AGENT_RUNTIME_URL is not configured",
      },
      { status: 503 },
    );
  }

  const payload = await request.json();
  const response = await fetch(`${cleanBaseUrl(runtimeUrl)}/api/work-items`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(runtimeToken ? { Authorization: `Bearer ${runtimeToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({
    error: `Runtime returned ${response.status}`,
  }));

  return NextResponse.json(data, { status: response.status });
}
