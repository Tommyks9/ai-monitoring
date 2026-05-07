# ai-monitoring

สำหรับทำ AI Agent Monitoring และ GUI ผ่าน Web App "Next.js (React) Tailwind CSS + shadcn/ui"
หรือจะพูดให้ถูกก็คือ Virtual Workspace for AI Agents

## OunJai AI Software House

repo นี้เริ่มวาง foundation สำหรับทีม AI Agents แบบ Software House ระดับ high-end ตาม OunJai Model โดยมี source of truth และ operating model ให้ agent หลายตัวทำงานร่วมกันได้อย่างเป็นระบบ

### ไฟล์สำคัญ

- `blueprints/system-blueprint.json` - master blueprint ของ OunJai microservices, ports, database strategy และ gateways
- `blueprints/agent-registry.json` - registry ของทีม/agent, responsibility, input/output และ approval gates
- `docs/agents/README.md` - prompt pack ภาษาไทยสำหรับ Architect, Shared Lib, Database, Lead Dev, Frontend, Documentation และ QA agents
- `docs/operations/agent-operating-model.md` - workflow, handoff, quality gates และลำดับการทำงานของทีม
- `docs/templates/agent-task-brief.md` - template สำหรับเปิดงานให้ agent แต่ละตัว

### วิธีเริ่มใช้งาน

1. เปิด `blueprints/system-blueprint.json` เป็น master source ของโปรเจกต์
2. เลือก agent จาก `docs/agents/README.md`
3. copy `docs/templates/agent-task-brief.md` แล้วเติม goal, scope และ acceptance criteria
4. ให้ agent ทำงานตาม `docs/operations/agent-operating-model.md`
5. ปิดงานด้วย handoff note, validation result และ next actions

### ทีม AI Agents

| ทีม | Agent | บทบาทสำคัญ |
| --- | --- | --- |
| Strategy & Blueprint | Architect & Shared Lib | วางพิมพ์เขียวระบบและคุม common contracts/libs |
| Development Backend | Lead Dev & DB Engineer | สร้าง NestJS services และออกแบบฐานข้อมูล/consistency |
| Development Frontend | Mobile & Web Dev | สร้าง React Native apps และ Next.js dashboard |
| Quality & Docs | QA & Documentation | เขียน tests, ตรวจ acceptance criteria และทำเอกสาร |
