# Decisions

- Follow [GitHub's README guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes): explain what the project does, how to start, where to get help, and who contributes.
- Keep language-specific prose in separate root files, with equivalent headings, commands, links, and capability boundaries. Retain actual Chinese UI labels in the English guide so readers can find the controls.
- Use relative repository links, a compact contents list, the existing character artwork, localized Mermaid diagrams, and a collapsed project tree. Preserve the original architecture image as an existing asset.
- Use `npm ci` for the committed lockfile and document only existing package scripts. Require a built-in persona entry when extending the character registry because its metadata directly reads `BUILTIN_PERSONAS`.
- Distinguish AI response languages from UI localization, a character registry from multiple bundled pets, and historical reports from current checks. Describe provider compatibility without guaranteeing every endpoint.

# Validation and Delivery

- Check Markdown parsing, headings and anchors, local links and image paths, fenced code blocks, command parity, and section parity.
- Review factual claims against package metadata, CI and packaging configuration, provider configuration, credential storage, character registry, renderer labels, and timer implementation.
- Run TypeScript checking locally. Do not run local build or unit-test commands that delete outputs or temporary files, in accordance with the user-provided filesystem-deletion prohibition.
- Use the pull request's hosted CI for build, unit tests, and secret scanning. Record its result separately from local checks. No GUI or live-provider acceptance is implied.
- Review the final diff, commit the scoped changes, push the task branch, and create a pull request. Leave merge and release to the maintainer.
