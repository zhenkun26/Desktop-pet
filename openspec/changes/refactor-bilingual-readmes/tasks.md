# Documentation

- [x] Inspect the existing README, project metadata, source behavior, and contribution conventions.
- [x] Write the English README and matching Simplified Chinese README with reciprocal navigation.
- [x] Preserve licensing, attribution, configuration details, and evidence limitations.
- [x] Update the existing changelog for the documentation change.
- [x] Check Markdown structure, relative links, image paths, anchors, commands, and translation parity.
- [x] Run TypeScript checking and review the scoped diff.
- [ ] Commit, push the task branch, and open a pull request against `main`.
- [ ] Observe and report hosted CI results.
- [ ] Maintainer review and merge; archive this change after merge.

# Verification Record

- PASS: Both READMEs parse as GitHub Flavored Markdown, with matching 20-heading structures, setup commands, command tables, and repository references. Each file has 46 checked link/image targets and nine documented command references. Chinese emphasis delimiters were corrected after inspecting parsed HTML.
- PASS: TypeScript checking via `node node_modules/typescript/bin/tsc --noEmit`. The local `.bin/tsc` shim is absent, so the installed compiler entry point was used directly.
- PASS: `git diff --check` and source-based content review. Only documentation and these OpenSpec artifacts are changed.
- NOT_RUN locally: unit tests and builds, whose cleanup behavior conflicts with the user-provided prohibition on filesystem deletion.
- PENDING: branch delivery and hosted CI. No GUI, live-provider, signed-package, or migration acceptance is claimed by this documentation change.
