# Run on Mac and Monitor Remote Agents

ทำได้: ให้ Mac ของคุณรัน dashboard แบบ local แล้วให้ dashboard ไปอ่านสถานะจาก remote agent runtime ผ่าน `AGENT_RUNTIME_URL`

## 1. Clone และ run บน Mac

```bash
git clone https://github.com/Tommyks9/ai-monitoring.git
cd ai-monitoring
npm install
cp .env.example .env.local
npm run dev
```

เปิด:

```text
http://localhost:3000
```

ถ้ายังไม่ตั้ง `AGENT_RUNTIME_URL` หน้า dashboard จะใช้ mock data ที่อยู่ใน repo

## 2. ต่อกับ remote agent runtime

แก้ไฟล์ `.env.local` บน Mac:

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

## 3. รูปแบบข้อมูลที่ remote ต้องส่ง

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

## 4. ถ้า remote ยังไม่ public

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

## 5. ถ้าจะให้คนอื่นเปิดดู dashboard บน Mac ของคุณ

ตัวนี้เป็นอีกกรณีหนึ่ง: ถ้าคุณรัน dashboard บน Mac แล้วอยากให้คนอื่นเปิดดูจากข้างนอก ให้ tunnel port 3000:

```bash
ngrok http 3000
```

แต่การ tunnel dashboard ไม่ได้ทำให้มีข้อมูล remote เอง ข้อมูล remote ยังต้องมาจาก `AGENT_RUNTIME_URL`

## 6. หมายเหตุด้านความปลอดภัย

- อย่าใส่ token ใน `NEXT_PUBLIC_*`
- ใช้ `AGENT_RUNTIME_TOKEN` เพราะ Next.js อ่านฝั่ง server เท่านั้น
- ถ้าใช้ public URL ให้เปิด CORS เฉพาะที่จำเป็น และใช้ bearer token
- อย่า commit `.env.local`
