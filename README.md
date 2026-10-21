# LastPatch (working name)

When does a smart device stop getting security updates? This project answers that for cameras, doorbells, routers, printers, smart plugs and more, with the manufacturer's own words as evidence.

Claude Code builds and runs everything. Humans only handle the gates listed in `.agent/progress/TASKS.md` (accounts, money, secrets, legal, publishing) and merge PRs that touch workflows, agent config or dependencies.

## Start here
1. Put this folder in a new private GitHub repo.
2. Open Claude Code on the repo: the Code tab in the Claude app, claude.ai/code, or `claude` in a local clone.
3. Paste the prompt in `KICKOFF.md`.
4. Work through the `needs-human` issues it opens (the daily build scheduled task is H4).

## Layout
| Path | What |
| --- | --- |
| `CLAUDE.md` | Agent rules and read order, loaded every session |
| `KICKOFF.md` | First prompt to paste |
| `docs/` | Brief, spec, architecture, data policy |
| `.agent/memory/` | Durable decisions and current context |
| `.agent/progress/` | Roadmap with exit checks, tasks and human gates, append-only log |
| `.agent/sessions/` | One note per working session |
| `.agent/prompts/` | Prompts for the scheduled tasks (daily build, nightly data refresh) |
| `data/` | Record schema, seed sources, device records (one YAML file per model) |
| `scripts/`, `tests/` | Data validator and its tests |
| `.claude/` | Claude Code permissions and the `add-device-record` skill |
| `.github/` | CI, optional `@claude` workflow, issue forms, PR template |

## Commands
```
npm ci            # install
npm run validate  # check every record against the schema and integrity rules
npm test          # unit tests
```
