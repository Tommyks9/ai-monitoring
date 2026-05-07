# ai-monitoring

สำหรับทำ AI Agent Monitoring และ GUI ผ่าน Web App "Next.js (React) Tailwind CSS + shadcn/ui"
หรือจะพูดให้ถูกก็คือ Virtual Workspace for AI Agents

## OunJai AI Software House

repo นี้เริ่มวาง foundation สำหรับทีม AI Agents แบบ Software House ระดับ high-end ตาม OunJai Model โดยมี source of truth และ operating model ให้ agent หลายตัวทำงานร่วมกันได้อย่างเป็นระบบ

## Monitoring Dashboard

โปรเจกต์นี้มี Next.js dashboard สำหรับ monitor ทีม AI Agents แล้ว โดยแสดงภาพรวม:

- health/progress ของ agent แต่ละตัว
- active task board และ blocker
- handoff/event stream
- service readiness จาก `system-blueprint.json`
- control loop ว่างานควรไหลจาก business goal ไปหา agent และ quality gate อย่างไร

### Run locally

```bash
npm install
cp .env.example .env.local
```

เปิด terminal แรกสำหรับ Agent Runtime:

```bash
npm run runtime
```

เปิด terminal ที่สองสำหรับ Dashboard:

```bash
npm run dev
```

เปิดเว็บที่:

```text
http://localhost:3000
```

จากหน้า dashboard ให้ใช้กล่อง **Create work item** เพื่อสั่งงานเข้า Agent Runtime ได้ทันที:

- เลือก owner agent
- เลือก service
- ตั้ง priority
- ใส่ acceptance gate
- กด **Send to agent queue**

Agent Runtime จะอยู่ที่:

```text
http://localhost:4000
```

ถ้าต้องการให้ dashboard บน Mac ดู agents ที่รันอยู่บน remote ให้ตั้งค่าใน `.env.local`:

```bash
AGENT_RUNTIME_URL=https://your-agent-runtime.example.com
AGENT_RUNTIME_TOKEN=optional-secret-token
```

ถ้าต้องการใช้ runtime local ที่มาพร้อม repo ให้ใช้ค่า default:

```bash
AGENT_RUNTIME_URL=http://localhost:4000
AGENT_RUNTIME_PORT=4000
```

ถ้าไม่ตั้งค่า `AGENT_RUNTIME_URL` dashboard จะใช้ mock data ใน repo และยัง run ได้ปกติ

### Validate

```bash
npm run lint
npm run typecheck
npm run build
```

### ไฟล์สำคัญ

- `blueprints/system-blueprint.json` - master blueprint ของ OunJai microservices, ports, database strategy และ gateways
- `blueprints/agent-registry.json` - registry ของทีม/agent, responsibility, input/output และ approval gates
- `blueprints/monitoring-schema.json` - schema กลางสำหรับ agent run, work item, event stream และ service readiness
- `docs/agents/README.md` - prompt pack ภาษาไทยสำหรับ Architect, Shared Lib, Database, Lead Dev, Frontend, Documentation และ QA agents
- `docs/operations/agent-operating-model.md` - workflow, handoff, quality gates และลำดับการทำงานของทีม
- `docs/operations/monitoring-dashboard.md` - data contract และ roadmap สำหรับต่อ orchestrator/backend monitoring
- `docs/operations/local-mac-remote-monitoring.md` - วิธี run dashboard บน Mac และดู remote agents
- `docs/templates/agent-task-brief.md` - template สำหรับเปิดงานให้ agent แต่ละตัว
- `runtime/agent-runtime.mjs` - local Agent Runtime API สำหรับส่งสถานะ agents/tasks/events ให้ dashboard
- `src/app/page.tsx` - Next.js dashboard หน้า command center
- `src/app/api/runtime/work-items/route.ts` - server-side proxy สำหรับส่ง task จาก dashboard ไป Agent Runtime

### วิธีเริ่มใช้งาน

1. เปิด `blueprints/system-blueprint.json` เป็น master source ของโปรเจกต์
2. เลือก agent จาก `docs/agents/README.md`
3. copy `docs/templates/agent-task-brief.md` แล้วเติม goal, scope และ acceptance criteria
4. ให้ agent ทำงานตาม `docs/operations/agent-operating-model.md`
5. ปิดงานด้วย handoff note, validation result และ next actions
6. monitor สถานะทีมผ่าน dashboard และอัปเดต event ตาม `blueprints/monitoring-schema.json`

### ทีม AI Agents

| ทีม | Agent | บทบาทสำคัญ |
| --- | --- | --- |
| Strategy & Blueprint | Architect & Shared Lib | วางพิมพ์เขียวระบบและคุม common contracts/libs |
| Development Backend | Lead Dev & DB Engineer | สร้าง NestJS services และออกแบบฐานข้อมูล/consistency |
| Development Frontend | Mobile & Web Dev | สร้าง React Native apps และ Next.js dashboard |
| Quality & Docs | QA & Documentation | เขียน tests, ตรวจ acceptance criteria และทำเอกสาร |
