# Agent Instructions — High-Quality Code Generation

这些是代理（AI 助手）与协作者在生成或修改代码时须遵循的规范。

## 1. General Principles

- **Readability over brevity**. Always choose the form that makes intent clearest.
- **Self-documenting names**. Variables, functions, and classes must reveal their purpose. Forbidden: `a`, `b`, `tmp`, `data`, `obj`, `stuff`, and similar meaningless identifiers.
- **Single responsibility**. Each function does exactly one thing, generally ≤50 lines (pure utility functions may exceed slightly).
- **No magic numbers**. Every literal constant must be defined as a named constant (module-level `UPPER_CASE`).
- **Errors must not be silenced**. Handle every possible error and edge case. Never use bare `except:` or swallow exceptions silently.
- **Minimize nesting**. Prefer guard clauses (early returns) to flatten control flow.
- **Public interfaces must be documented**. Every exported function, method, or class must carry a docstring or documentation comment.

## 2. Python (when generating Python code)

- Strict PEP 8; max 100 characters per line.
- Full type annotations on all functions (`typing` module). Classes must explicitly initialize every instance attribute in `__init__`.
- Always use f-strings for formatting — never `%` or `.format()`.
- Use `pathlib` for file paths; use `with` (context manager) for resource management.
- Use `async`/`await` for async code. Never call blocking functions inside a coroutine.
- Public function docstrings in Google style: include `Args`, `Returns`, `Raises` sections.

## 3. Security

- **All external input is untrusted**. Validate and sanitize before use.
- **Always use parameterized queries** for SQL. Never concatenate user input into query strings.
- Escape user-generated content before rendering into HTML (XSS prevention).
- **Never hardcode secrets** — keys, passwords, tokens. Use environment variables or a secrets manager.
- Set timeouts and retries for external API calls; catch network exceptions.
- Validate file paths before file operations or system commands (path traversal prevention).
- **For destructive operations** — deleting files, dropping tables, truncating data — confirm with the user before proceeding.

## 4. Testing

- Produce testable code: pure functions or clearly-scoped side effects.
- Generate unit tests for every public interface covering: happy path, edge cases, error paths.
- Structure tests with Given-When-Then (Arrange-Act-Assert).
- Name tests descriptively: `test_should_<expected_behaviour>_when_<condition>` (e.g., `test_should_return_default_when_input_is_none`).
- Mock external dependencies (DB, network, filesystem) — keep tests fast and self-contained.

## 5. Data Processing (when pandas / SQL is involved)

- Explicitly specify `axis` and `inplace` in DataFrame operations.
- Avoid `SettingWithCopyWarning`; prefer `.loc` / `.iloc`.
- In SQL, filter large tables before joining — avoid Cartesian products. Use `EXPLAIN` to assess query efficiency.

## 6. Backend (when APIs / server-side code is involved)

- Follow standard HTTP method semantics for RESTful endpoints.
- Unified response envelope: `{ "code": 0, "data": ..., "message": "success" }`.
- Validate request parameters and return meaningful 4xx error messages.
- Use middleware for cross-cutting concerns: error handling, logging, authentication.
- Always paginate database queries (`LIMIT` / `OFFSET`); never `SELECT *` without a limit.

## 7. Frontend (when React / Vue / component code is involved)

- One UI responsibility per component. Props and state must be clearly defined.
- Type checking: TypeScript preferred; PropTypes as fallback.
- Do not create new objects or functions inside render. Use `useCallback` / `useMemo`.
- Separate styles from component logic: CSS Modules or Tailwind utility classes.
- Keep state local by default; lift to Context or a global store only when shared.

## 8. Output Requirements

When generating code, always include:

1. **Complete code** — with all imports, type annotations, and docstrings.
2. **A brief rationale** — the key design decision and why it was made.
3. **Corresponding unit tests** — where applicable.
