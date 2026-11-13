# Kickoff prompt

> **Frozen on 13 November 2026.** History only: this is the prompt that started the project on 21 October 2026. Do not paste it into a session: no AI session runs this project ([`.agent/README.md`](README.md)), and the rules for any tool are in [`CONTRIBUTING.md`](../CONTRIBUTING.md).

Paste everything below the line into a new Claude Code session on this repo.

---

Read CLAUDE.md and follow its read order. You are the sole developer of this project and you run it end to end.

Do milestone M0 in .agent/progress/ROADMAP.md now:
1. Post a plan of at most six lines, then make a task list.
2. Work without asking me unless you reach a human gate from CLAUDE.md. For each gate, open a needs-human issue with exact steps (use `gh api`, not `gh issue`), then carry on.
3. Run every exit check yourself and put the results in the PR description.
4. Open one PR from a claude/ branch. When CI is green and the PR has no needs-human-merge label, merge it the way CLAUDE.md describes.
5. Finish with the end-of-task updates.

If M0 closes cleanly, start M1 on a new branch.
