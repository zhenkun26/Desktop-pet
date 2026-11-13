# Documentation

- [x] Inspect the existing README, project metadata, source behavior, and contribution conventions.
- [x] Write the English README and matching Simplified Chinese README with reciprocal navigation.
- [x] Preserve licensing, attribution, configuration details, and evidence limitations.
- [x] Update the existing changelog for the documentation change.
- [x] Check Markdown structure, relative links, image paths, anchors, commands, and translation parity.
- [x] Run TypeScript checking and review the scoped diff.
- [x] Commit, push the task branch, and open a pull request against `main`.
- [x] Observe and report hosted CI results.
- [ ] Maintainer review and merge; archive this change after merge.

# Verification Record

- PASS: Both READMEs parse as GitHub Flavored Markdown, with matching 20-heading structures, setup commands, command tables, and repository references. Each file has 46 checked link/image targets and nine documented command references. Chinese emphasis delimiters were corrected after inspecting parsed HTML.
- PASS: TypeScript checking via `node node_modules/typescript/bin/tsc --noEmit`. The local `.bin/tsc` shim is absent, so the installed compiler entry point was used directly.
- PASS: `git diff --check` and source-based content review. Only documentation and these OpenSpec artifacts are changed.
- NOT_RUN locally: unit tests and builds, whose cleanup behavior conflicts with the user-provided prohibition on filesystem deletion.
- PASS: GitHub previews for both READMEs, reciprocal language navigation, character artwork, Chinese emphasis, and both localized Mermaid diagrams were inspected in the browser.
- PASS: [Hosted CI run 34](https://github.com/zhenkun26/Desktop-pet/actions/runs/43371131924) for content commit `f07d3fd`: dependency installation, TypeScript, build, unit tests, and Gitleaks secret scanning all succeeded. This verification-record follow-up does not change application code or the READMEs; its new head receives the same required CI workflow.
- DELIVERED: branch `codex/refactor-bilingual-readmes` and [PR #13](https://github.com/zhenkun26/Desktop-pet/pull/13) targeting `main`. The pull request remains open for maintainer review; no merge or release was performed.
- NOT_RUN: application GUI, live-provider, signed-package, and migration acceptance. README browser inspection is distinct from application acceptance.
