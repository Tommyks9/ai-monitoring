# Agent Runner Integration

เอกสารนี้อธิบายวิธีต่อ OunJai Agent Runtime เข้ากับ runner จริง เช่น CrewAI, AutoGen หรือ custom worker service

## Runtime dispatch modes

ตั้งค่าผ่าน `.env.local`:

```bash
AGENT_DISPATCH_MODE=hybrid
```

| Mode | Behavior |
| --- | --- |
| `local` | Runtime assign งานและจำลอง worker ภายใน process เดียว เหมาะสำหรับ demo/local |
| `webhook` | Runtime ต้องส่งงานไป agent runner URL เท่านั้น ถ้าส่งไม่ได้ task จะเป็น blocked |
| `hybrid` | Runtime ส่งงานไป runner URL ถ้ามี ถ้าไม่มีหรือส่งไม่ได้จะ fallback เป็น local worker |

## Configure runner URLs

ใช้ URL กลางสำหรับทุก agent:

```bash
AGENT_RUNNER_URL=http://localhost:5050/agent-dispatch
AGENT_RUNNER_TOKEN=
```

หรือแยก URL ต่อ agent:

```bash
AGENT_RUNNER_LEAD_DEVELOPER_AGENT_URL=http://localhost:5051/dispatch
AGENT_RUNNER_SHARED_LIB_AGENT_URL=http://localhost:5052/dispatch
AGENT_RUNNER_DATABASE_ENGINEER_AGENT_URL=http://localhost:5053/dispatch
```

ชื่อ env ต่อ agent ใช้ rule:

```text
AGENT_RUNNER_<AGENT_ID upper-case และเปลี่ยน - เป็น _>_URL
```

ตัวอย่าง:

```text
lead-developer-agent -> AGENT_RUNNER_LEAD_DEVELOPER_AGENT_URL
```

## Payload ที่ runtime ส่งให้ runner

เมื่อ task ถูก assign runtime จะ `POST` JSON ไปที่ runner:

```json
{
  "event": "work_item.assigned",
  "runtime": {
    "name": "OunJai Agent Runtime",
    "callbackBaseUrl": "http://localhost:4000"
  },
  "agent": {
    "id": "lead-developer-agent",
    "name": "Lead Developer Agent",
    "team": "Development Backend",
    "prompt": "คุณคือ Lead Developer...",
    "fineTuningProfile": "nestjs-clean-architecture-generation",
    "primaryInputs": ["blueprints/system-blueprint.json"],
    "primaryOutputs": ["NestJS service skeletons"],
    "approvalGates": ["ports ตรงกับ blueprint"]
  },
  "workItem": {
    "id": "OUNJAI-005",
    "title": "Generate identity-service skeleton",
    "owner": "Lead Developer Agent",
    "priority": "critical",
    "state": "in_progress",
    "service": "identity-service",
    "acceptanceGate": "Clean Architecture layers exist"
  },
  "sourceOfTruth": {
    "systemBlueprint": {},
    "agentRegistry": {},
    "fineTuning": {}
  },
  "callbackEndpoints": {
    "heartbeat": "/api/agent-runs/lead-developer-agent/heartbeat",
    "events": "/api/agent-runs/lead-developer-agent/events",
    "state": "/api/work-items/OUNJAI-005/state"
  }
}
```

## Callback จาก runner กลับ runtime

### Heartbeat / progress

```bash
curl -X POST http://localhost:4000/api/agent-runs/lead-developer-agent/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "workItemId": "OUNJAI-005",
    "status": "working",
    "progress": 55,
    "lastSignal": "Generated domain and presentation layers"
  }'
```

### Event / handoff

```bash
curl -X POST http://localhost:4000/api/agent-runs/lead-developer-agent/events \
  -H "Content-Type: application/json" \
  -d '{
    "workItemId": "OUNJAI-005",
    "type": "handoff",
    "status": "review",
    "progress": 100,
    "handoff": "identity-service skeleton ready; ports and layers validated"
  }'
```

### Complete task

```bash
curl -X PATCH http://localhost:4000/api/work-items/OUNJAI-005/state \
  -H "Content-Type: application/json" \
  -d '{
    "state": "done",
    "agent": "Lead Developer Agent",
    "handoff": "All acceptance gates passed"
  }'
```

## Fine-tuning source

ใช้ `blueprints/agent-runtime-contract.json` เป็นแหล่งกลางสำหรับ:

- prompt ภาษาไทยต่อ agent
- fine-tuning profile ต่อ agent
- dataset policy
- source ที่อนุญาตให้นำไป fine-tune
- source ที่ห้ามนำไป train เช่น secrets, `.env`, customer data

ก่อนนำ output เข้า fine-tuning set ต้องผ่าน review จาก QA Automation Agent และ Documentation Agent
