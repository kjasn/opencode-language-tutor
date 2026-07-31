# Repository Guidelines

## Project Structure & Module Organization

- `src/index.ts` is the OpenCode plugin entry point and wires event and chat-message hooks.
- `src/core.ts` contains prompt parsing and eligibility rules; `src/tutor-llm.ts` owns model calls.
- `src/setting.ts` persists language-tutor preferences, and `src/tutor-state.ts` holds per-session results.
- `src/tui.tsx` provides the OpenTUI/Solid interface and presentation helpers.
- `test/` mirrors source concerns with Bun tests, for example `test/setting.test.ts`.

Keep new behavior in the smallest relevant module. Prefer importing with explicit `.ts` or `.tsx` extensions, matching the existing source.

## Documentation

- `README.md` is the English README, and `README.zh-CN.md` is its Simplified Chinese translation.
- Keep both README files synchronized whenever either one changes. Preserve equivalent sections, commands, examples, warnings, and behavior descriptions in both languages.

## OpenCode Integration

- `.opencode/agents/language-tutor.md` is executable OpenCode agent configuration for isolated tutor model calls. It is not documentation.
- `askTutor()` must continue to select `agent: "language-tutor"`; this agent disables every tool for models that do not support tool calling.
- Do not replace the no-tools agent with `tools: {}` in `session.prompt`. An empty map leaves the selected agent's default tool set unchanged.
- Check the effective local configuration with `opencode debug config | rg -n -A12 -B2 '"language-tutor"'` after changing the agent definition.

## Build, Test, and Development Commands

- `bun install` installs dependencies from `bun.lock`.
- `bun run check` runs TypeScript's strict, no-emit type check.
- `bun test` runs the complete Bun test suite.
- `bun test test/setting.test.ts` runs one test file while iterating.

There is no separate build or lint script currently. Run both `bun run check` and `bun test` before submitting changes.

## Releases

- `.github/workflows/release.yml` runs only when a `v*` tag is pushed.
- Pushing a version tag, for example `v0.1.0`, validates the tagged commit and creates a GitHub release with source archives and generated release notes.

## Coding Style & Naming Conventions

Write TypeScript using four-space indentation, semicolons, double-quoted strings, and trailing commas in multiline calls and objects. Use `camelCase` for values and functions, `PascalCase` for types/classes/components, and descriptive module names such as `tutor-state.ts`. Keep exports typed; the compiler is configured with `strict` and `noUncheckedIndexedAccess`.

Prefer Bun APIs and commands over Node package-manager tooling. Handle external API and filesystem failures deliberately, especially in background plugin work, so user-facing events remain resilient.

## Testing Guidelines

Use `bun:test` with `test`/`describe` and `expect`. Name tests as behavior statements, such as `"loads defaults, then persists updates"`. Add or update focused tests for parsing, persistence, prompt rules, and UI text transformations whenever those behaviors change. Tests that create files must use temporary directories and clean them up, as `setting.test.ts` does.

## Commit & Pull Request Guidelines

Use concise, imperative commit subjects. Existing history favors Conventional Commit-style prefixes, e.g. `feat: tutor settings persistence, llm calling...`; use `fix:`, `test:`, or `docs:` where appropriate. Keep each commit scoped to one change.

Pull requests should explain the behavior change, note configuration or model-call effects, link relevant issues, and include screenshots or terminal output when UI/toast behavior changes. State the commands run and ensure no generated or local settings files are committed.
