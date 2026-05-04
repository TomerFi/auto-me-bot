# Auto-Me-Bot

Probot GitHub App that automates repository management through configurable handlers.

## Architecture
- **Config Types**: Event types (currently only 'pr')
- **User config**: `.github/auto-me-bot.yml`

## Coding Standards
- Line length: 100 chars (JS), 120 chars (Markdown)
- Async patterns: `async/await` (no raw Promises)
- Error handling: Always catch and report API errors

## Testing
- Test `match()` and `run()` separately for each handler
- Mock all GitHub API calls (`context.octokit`)
- Achieve full coverage for handler logic
- Use descriptive test names
- Test fixtures live in `tests/fixtures/`

Run `npm test` for tests with coverage verification
Run `npm run tests` for faster iteration without coverage

## Handler Development
Every handler in `src/handlers/` MUST export:
1. `match(context)` - Returns boolean, determines if handler should run
2. `run(context, config, startedAt)` - Async function that executes handler logic

### Handler Lifecycle (PR handlers)
1. Create check-run with status `in_progress`
2. Perform handler operations
3. Update check-run with status `completed` and appropriate conclusion

### Registration
- Add handler to `CONFIG_SPEC` in `src/auto-me-bot.js`
- Events are registered in `ON_EVENTS` in `src/auto-me-bot.js`

## Documentation

- `docs/index.md` — Overview, `docs/install.md` — Installation, `docs/config.md` — Config reference, `docs/examples.md` — Examples, `docs/handlers/*.md` — Individual handlers

### When to Update
- **New handler:** create `docs/handlers/handler-name.md`, update `mkdocs.yml` navigation, add config options to `docs/config.md`, add example to `docs/examples.md`
- **Modified handler:** update corresponding handler doc, config examples, screenshots if behavior changed
- **API changes:** update config and examples docs

Test with `mkdocs serve` before committing.

## CI/CD
- Deployment uses GCP Cloud Functions Gen2 via `gcloud functions deploy`

