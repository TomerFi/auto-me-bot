# Auto-Me-Bot AGENTS.md

## AI Policy

This project has an [AI policy](AI_POLICY.md). Always read it and ensure all suggestions, code, and contributions comply. If any behavior seems to conflict with the policy, warn the user and ask for guidance.

## Project Overview

Auto-Me-Bot is a [Probot][probot] GitHub App that automates repository management through configurable handlers. It processes GitHub webhook events (currently `pull_request` and `pull_request_review`) and performs checks and actions based on configuration in `.github/auto-me-bot.yml`.

### Architecture

#### Handler Pattern

All handlers follow this structure:

1. `match(context)` — Returns boolean, determines if handler should run
2. `run(context, config, startedAt)` — Async function that executes handler logic
3. Creates a check-run with status `in_progress`
4. Performs handler operations
5. Updates check-run with status `completed` and appropriate conclusion

#### Constraints

- Every handler in `src/handlers/` MUST export `match` and `run`
- Register handlers in `CONFIG_SPEC` in `src/auto-me-bot.js`
- Register events in `ON_EVENTS` in `src/auto-me-bot.js`
- Add handler tests and register them in the test suite
- Add handler documentation and update the MkDocs navigation and examples
- Verify handler tests and lint before submitting

## Working Environment

- Use **`package.json`** for all dependencies and scripts
- This project uses [**husky**][husky] for Git hooks with [**lint-staged**][lint-staged] for file-specific checks
- The pre-commit hook blocks commits to `main`, verifies lock file consistency, checks assistant files are in sync, and runs lint-staged on staged files

## Linting

```bash
npm run lint                              # lint (read-only, includes eslint, prettier, ec, actionlint)
npm run eslint                            # eslint src tests
npm run eslint:fix                        # eslint --fix src tests
npm run prettier                          # prettier --write
npm run prettier:fix                      # prettier --write (alias)
npm run ec                                # editorconfig-checker
npm run actionlint                        # github actions linter
```

## Testing

```bash
npm run tests                             # run tests
npm test                                  # run tests with coverage verification
npm run tests:rep                         # run tests and output JSON report
```

## Developer Workflow

- Branch from `main` with a conventional name: `feat/add-handler`, `fix/handler-bug`
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- One logical change per commit
- Open PR with a clear description of what changed and why

## Additional Documentation

For contributing guidelines, IDE configuration, and handler development details, see [CONTRIBUTING.md](CONTRIBUTING.md).

[probot]: https://probot.github.io
[husky]: https://typicode.github.io/husky/
[lint-staged]: https://github.com/okonet/lint-staged
