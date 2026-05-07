# AI Monitoring

Next.js (React) + Tailwind CSS + shadcn/ui web application for AI Agent Monitoring.

## Cursor Cloud specific instructions

### Tech Stack
- **Framework**: Next.js 16 with App Router (TypeScript)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Package Manager**: npm (use `package-lock.json`)

### Common Commands
| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (port 3000) |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Production | `npm run start` |

### Adding shadcn/ui Components
```bash
npx shadcn@latest add <component-name>
```

### Notes
- The dev server runs on port 3000 by default.
- Tailwind CSS v4 uses `@import "tailwindcss"` in `globals.css` (no `tailwind.config.js`).
- shadcn/ui config lives in `components.json` at the project root.
- Components are generated into `src/components/ui/`.
