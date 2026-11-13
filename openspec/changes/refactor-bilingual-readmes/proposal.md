# Why

The root README mixes English and Chinese in each section, repeats feature descriptions, and omits cloning from the quick start. Visitors need a clear project introduction and a complete path from setup to their first conversation in their preferred language.

# What Changes

- Make `README.md` the English entry point and add `README-zh.md` for Simplified Chinese.
- Use matching sections and reciprocal language links, with focused features, setup, configuration, development, extension, support, and license guidance.
- Replace the embedded architecture image with localized Mermaid diagrams that include provider routing.
- Verify instructions against the source and preserve artwork restrictions, contributor attribution, and historical-evidence limitations.
- Record the documentation change in the existing changelog.

`skip_specs: true` — documentation only; no application behavior, dependencies, or release settings change.

# Capabilities

No new or modified behavior specifications.

# Impact

The two READMEs, the existing changelog, and this change's planning and verification artifacts. Existing historical reports and artwork remain intact. Delivery is a branch and pull request against `main`; merge and release are outside this change.
