# Run on Mac and Monitor Remote Agents

ทำได้: ให้ Mac ของคุณรัน dashboard แบบ local แล้วให้ dashboard ไปอ่านสถานะจาก Agent Runtime ผ่าน `AGENT_RUNTIME_URL`

repo นี้มี runtime local ให้แล้วที่ `runtime/agent-runtime.mjs` สำหรับเริ่มต้น monitor ได้ทันที

## 1. Clone และตั้งค่า env

```bash
git clone https://github.com/Tommyks9/ai-monitoring.git
cd ai-monitoring
npm install
cp .env.example .env.local
```

ค่า default ใน `.env.local` จะเป็น:

```bash
AGENT_RUNTIME_URL=http://localhost:4000
AGENT_RUNTIME_PORT=4000
AGENT_RUNTIME_TOKEN=
AGENT_RUNTIME_CORS_ORIGIN=http://localhost:3000
```

## 2. Run local Agent Runtime

เปิด terminal แรก:

```bash
npm run runtime
```

runtime จะเปิดที่:

```text
http://localhost:4000
```

ลองตรวจ:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/agents
```

## 3. Run dashboard

เปิด terminal ที่สอง:

```bash
npm run dev
```

เปิด:

```text
http://localhost:3000
```

หน้า dashboard จะดึงข้อมูลจาก `http://localhost:4000` และ refresh ทุก 20 วินาที

ถ้าลบหรือเว้นว่าง `AGENT_RUNTIME_URL` หน้า dashboard จะ fallback ไปใช้ mock data ที่อยู่ใน repo

## 4. สั่งงานทีมจากหน้า dashboard

ในหน้า `http://localhost:3000` จะมีกล่อง **Create work item**

ให้กรอก:

1. **Task title** - งานที่ต้องการให้ agent ทำ
2. **Owner agent** - agent ที่รับผิดชอบ
3. **Service** - service หรือ scope ที่เกี่ยวข้อง
4. **Priority** - critical/high/medium/low
5. **Acceptance gate** - เงื่อนไขที่ต้องผ่านก่อนปิดงาน

เมื่อกด **Send to agent queue** dashboard จะยิงคำสั่งผ่าน server-side proxy:

```http
POST /api/runtime/work-items
```

แล้ว proxy ต่อไปยัง Agent Runtime:

```http
POST http://localhost:4000/api/work-items
```

วิธีนี้ช่วยไม่ให้ token ของ runtime ถูกส่งไปอยู่ฝั่ง browser โดยตรง

## 5. ต่อกับ remote agent runtime

ถ้าคุณ deploy runtime ไว้ที่ server หรือ VM ให้แก้ไฟล์ `.env.local` บน Mac:

```bash
AGENT_RUNTIME_URL=https://your-agent-runtime.example.com
AGENT_RUNTIME_TOKEN=optional-secret-token
```

แล้ว restart dev server:

```bash
npm run dev
```

dashboard จะเรียก endpoint เหล่านี้จาก remote:

```http
GET /api/agents
GET /api/work-items
GET /api/events
GET /api/services/readiness
```

ถ้า remote ใช้ token ให้ส่ง header:

```http
Authorization: Bearer <AGENT_RUNTIME_TOKEN>
```

## 6. Local runtime endpoints

runtime local ที่มากับ repo รองรับ endpoints เหล่านี้:

```http
GET /health
GET /api/agents
GET /api/work-items
GET /api/events
GET /api/services/readiness
GET /api/snapshot
POST /api/work-items
PATCH /api/work-items/:id/state
POST /api/agent-runs/:id/events
POST /api/agent-runs/:id/heartbeat
```

ตัวอย่างเพิ่มงาน:

```bash
curl -X POST http://localhost:4000/api/work-items \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Generate identity-service skeleton",
    "owner": "Lead Developer Agent",
    "priority": "critical",
    "service": "identity-service",
    "acceptanceGate": "Clean Architecture layers exist"
  }'
```

ตัวอย่างส่ง heartbeat:

```bash
curl -X POST http://localhost:4000/api/agent-runs/lead-developer-agent/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "status": "working",
    "progress": 68,
    "lastSignal": "Generated identity-service module shell"
  }'
```

## 7. รูปแบบข้อมูลที่ remote ต้องส่ง

ให้ remote runtime ส่ง JSON ตาม contract ใน:

```text
blueprints/monitoring-schema.json
```

ตัวอย่าง `/api/agents`:

```json
[
  {
    "id": "run-lead-dev-001",
    "agentId": "lead-developer-agent",
    "agentName": "Lead Developer Agent",
    "team": "Development Backend",
    "status": "working",
    "currentTask": "Generate NestJS service skeletons",
    "health": 84,
    "progress": 52,
    "queueDepth": 9,
    "lastSignal": "Service-to-port map imported from blueprint",
    "risk": "Waiting for CLI runtime"
  }
]
```

## 8. ถ้า remote ยังไม่ public

คุณมี 2 ทางเลือก:

1. deploy agent runtime เป็น public/private URL เช่น Render, Railway, Fly.io, VPS หรือ Kubernetes
2. tunnel runtime จากเครื่อง/VM ที่รัน agents ด้วย Cloudflare Tunnel หรือ ngrok

ตัวอย่าง ngrok:

```bash
ngrok http 4000
```

แล้วนำ URL ที่ได้ไปใส่:

```bash
AGENT_RUNTIME_URL=https://xxxx.ngrok-free.app
```

## 9. ถ้าจะให้คนอื่นเปิดดู dashboard บน Mac ของคุณ

ตัวนี้เป็นอีกกรณีหนึ่ง: ถ้าคุณรัน dashboard บน Mac แล้วอยากให้คนอื่นเปิดดูจากข้างนอก ให้ tunnel port 3000:

```bash
ngrok http 3000
```

แต่การ tunnel dashboard ไม่ได้ทำให้มีข้อมูล remote เอง ข้อมูล remote ยังต้องมาจาก `AGENT_RUNTIME_URL`

## 10. หมายเหตุด้านความปลอดภัย

- อย่าใส่ token ใน `NEXT_PUBLIC_*`
- ใช้ `AGENT_RUNTIME_TOKEN` เพราะ Next.js อ่านฝั่ง server เท่านั้น
- ถ้าใช้ public URL ให้เปิด CORS เฉพาะที่จำเป็น และใช้ bearer token
- อย่า commit `.env.local`
