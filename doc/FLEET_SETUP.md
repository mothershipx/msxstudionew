# OpenClaw Fleet Setup

Use this guide when a new org or operator needs the same local MSX fleet that powers the current board.

## What transfers with the repo

The GitHub repo only contains the MSX application and the fleet sync logic.

The actual `157` agents do **not** live in git. They live in the operator's local OpenClaw home:

- `~/.openclaw/openclaw.json`
- `~/.openclaw/agency-agents/`
- `~/.openclaw/agents/`

MSX mirrors that local OpenClaw fleet into the board with:

```bash
pnpm sync:openclaw-fleet
```

## Fastest ways to recreate the same fleet

### Option A: mirror an existing operator machine

This is the fastest internal path when you already trust the source machine.

1. Install OpenClaw on the new machine.
2. Bring over the local OpenClaw fleet assets:
   - `~/.openclaw/agency-agents/`
   - `~/.openclaw/agents/`
   - the agent list in `~/.openclaw/openclaw.json`
3. Verify the new machine sees the fleet:

```bash
openclaw agents list --json
```

Expected result: the list includes `main`, `agents-orchestrator`, and the full specialist fleet.

Security note: do not blindly copy tokens or third-party secrets unless you intentionally want the new machine to share those integrations.

### Option B: rebuild the same OpenClaw fleet

Use this when the new org wants a clean install path.

1. Install OpenClaw.
2. Install the same specialist pack into `~/.openclaw/agency-agents`.
3. Register those agents with OpenClaw until:

```bash
openclaw agents list --json
```

shows the full fleet.

## One-command bootstrap into MSX

Once the local OpenClaw fleet exists, clone the MSX repo and run:

```bash
pnpm install
pnpm bootstrap:openclaw-fleet
```

The bootstrap command:

- checks that `pnpm` and `openclaw` are installed
- checks that `~/.openclaw/openclaw.json` exists
- verifies the local fleet includes `main` and `agents-orchestrator`
- expects `157` agents by default
- runs the MSX import bridge

If your fleet count is intentionally different, you can skip the exact-count check:

```bash
MSX_EXPECT_OPENCLAW_AGENTS=0 pnpm bootstrap:openclaw-fleet
```

## Starting MSX after the import

```bash
pnpm dev
```

Then open:

```text
http://127.0.0.1:3100
```

## Verification checklist

- `openclaw agents list --json` shows the expected fleet locally
- `pnpm bootstrap:openclaw-fleet` completes without errors
- MSX shows the imported fleet in the sidebar and agent views
- `agents-orchestrator` and `main` are present in MSX

## Related files

- `scripts/bootstrap-openclaw-fleet.mjs`
- `scripts/sync-openclaw-fleet.mjs`
- `doc/OPENCLAW_ONBOARDING.md`
