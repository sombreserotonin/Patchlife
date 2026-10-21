# 2026-10-21 M1 verifier core

Daily build. No open PRs to merge. Built the pure part of the SPEC 3 verifier for HTML: strip scripts and styles, decode entities, NFKC and whitespace normalise, case-insensitive quote match, SHA-256 of the normalised text. `verifyRecord` returns the new `verification` block or a failure reason and never mutates the record. With several evidence items the hash covers their normalised texts joined by newlines.

Left for later tasks: fetching (blocked on #9 and #10), PDF text (new dependency, protected `package.json`, human merge), archive snapshot, the CLI and `npm run verify:evidence` wiring.
