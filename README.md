# Chess Master

Chess Master is a standalone Android-ready chess learning app with interactive
lessons, puzzles, local chess play, and an optional server-side tutor API.

## Local development

Prerequisite: Node.js and a separately approved dependency installation.

```powershell
pnpm install
pnpm run api:dev
pnpm run dev
```

Copy `.env.example` to `.env` only when configuring a local frontend API URL.
The backend requires its own provider credentials before live tutor requests
can work; this repository does not include those credentials.

See [SOURCE.md](SOURCE.md) for extraction provenance and standalone validation
commands.
