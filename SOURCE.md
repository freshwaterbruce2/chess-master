# Chess Master source provenance

This standalone project was created on 2026-08-25 from the verified local
snapshot `C:\projects\_vibe-snapshots\chess-master-preextract-20260825-041630`.
The copied app source originated from the local `vibe-chess` app. Its Chess
source slice is vendored at `packages/games/src/chess` and consumed through the
local `@chess-master/games` file dependency. The active 3D board closure was
copied directly from the corresponding local games source after its use was
confirmed; it was not part of the earlier Chess-only snapshot.

The active app uses its 3D board route. Its minimal source closure is vendored
at `packages/games/src/three` (`ChessBoard3D.tsx`, `ChessPieces3D.tsx`, and
`ChessPiecePrimitives3D.tsx`), with its existing Three.js dependencies declared
in the standalone manifests.

The requested GitHub destination is held for a separate publication decision.
No GitHub repository inspection, Git initialization, remote configuration, or
push occurred during extraction.

## Standalone commands

After a separately approved dependency install, run these from this directory:

```powershell
pnpm install
pnpm run typecheck
pnpm run validate:lessons
pnpm run validate:chess-ai
pnpm run build
```

Android sync and build commands are present in `package.json`, but are not run
as part of this extraction foundation.
