# Contributing to *auto-me-bot*

Thank you for contributing. This guide covers the essentials.

## AI Policy

This project has a clear AI policy — read [AI_POLICY.md](AI_POLICY.md) and follow it. You're responsible for everything you submit.

## Setup

```bash
git clone <repo-url>
cd auto-me-bot
npm install
```

See [AGENTS.md](AGENTS.md) for linting and testing commands.

## Local Checks

This project uses [husky][husky] with [lint-staged][lint-staged]. The pre-commit hook enforces:

- **Branch protection** — blocks commits directly to `main`
- **Lock file consistency** — verifies `package-lock.json` matches `package.json`
- **Assistant files** — uses [aicfg](https://github.com/TomerFi/aicfg) to sync project instructions (`.agents`, `AGENTS.md`) across editors; run `npm run link-ai-files` to link for Claude Code
- **File-specific checks** — eslint, editorconfig-checker, and actionlint run only on changed files via [lint-staged][lint-staged]; prettier is pending codebase formatting

```bash
# Auto-installed by `npm install`
# Runs automatically on every commit (unless on main, which is blocked)
```

To run checks manually against all files:

```bash
npm run eslint
npm run prettier
npm run ec
```

To run lint-staged manually:

```bash
npx lint-staged
```

## Commit Style

- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- One logical change per commit

## PR Process

1. Branch from `main` with a conventional name: `feat/add-handler`, `fix/handler-bug`
2. Commit with a descriptive message
3. Run all checks before submitting: `npm run lint && npm run actionlint && npm run link-ai-files -- --ci && npm test`
4. Open PR with a clear description of what changed and why
5. Address feedback

## Project Walkthrough

*auto-me-bot* was created around the concept of *handlers* and *config types*. A *config type* is the type of *GitHub* event, i.e. *pull_request*. A *handler* represents an operation supported for a *config type*.

```yaml
pr:
  conventionalCommits:
  conventionalTitle:
  lifecycleLabels:
  signedCommits:
  tasksList:
```

### Developing Handlers

All handlers are located in [src/handlers/](src/handlers/). Handlers **MUST** export 2 functions:

A *match* function that will be used for matching incoming events, it takes [Probot's context][context] and is expected to return a boolean indicating whether or not the handler can handle the current request:

```javascript
module.exports.match = function(context) {
    let event = 'pull_request';
    let actions = ['opened', 'edited'];
    return event in context.payload ? actions.includes(context.payload.action) : false;
}
```

A *run* function that will be used for handling a request, it will be invoked only if the *match* function returns *true*. It takes [Probot's context][context], the configuration for the handler, and an *ISO8601 timestamp* marking the start of the handler run:

> Note that *config* contains the running handler configuration **only** and nothing above it, so other handlers configuration will not be available.

```javascript
module.exports.run =  async function(context, config, startedAt) {
  // ...
}
```

For pull requests, the run function is expected to [create a check-run][checks-create] right off its invocation, and mark its *status* as *in_progress*:

```javascript
module.exports.run =  async function(context, config, startedAt) {

    let checkRun = await context.octokit.checks.create(context.repo({
        head_sha: context.payload.pull_request.head.sha,
        name: CHECK_NAME,
        details_url: BOT_CHECK_URL,
        started_at: startedAt,
        status: 'in_progress'
    }));

    // ...
}
```

The *run* function is also expected, as a final stage, to [update the previously created check-run][checks-update], and mark its *status* as *completed*. Use the *conclusion* and *output* keys to relay the check-run result:

```javascript
module.exports.run =  async function(context, config, startedAt) {

    await context.octokit.checks.update(context.repo({
        check_run_id: checkRun.data.id,
        name: CHECK_NAME,
        details_url: BOT_CHECK_URL,
        started_at: startedAt,
        status: 'completed',
        completed_at: new Date().toISOString(),
        conclusion: 'success',
        output: {
            title: 'Check passed',
            summary: 'All good!'
        }
    }));
}
```

### Adding Handlers to Tests

#### Include the handler

Look for the *allHandlers* list variable, add the new handler to this list:

```javascript
// all handlers should be listed here for testing purposes
allHandlers = [
    conventionalCommitsHandlerStub,
    conventionalTitleHandlerStub,
    lifecycleLabelsHandlerStub,
    signedCommitsHandlerStub,
    tasksListHandlerStub,
];
```

#### Update the configuration

Look for the *patchedConfigSpec* object and add the handler's configuration key pointing to the patch you created:

```javascript
// create a patched config spec for injecting the patched handlers into the application
patchedConfigSpec = {
    pr: {
        conventionalCommits: conventionalCommitsHandlerPatch,
        conventionalTitle: conventionalTitleHandlerPatch,
        lifecycleLabels: lifecycleLabelHandlerPatch,
        signedCommits: signedCommitsHandlerPatch,
        tasksList: tasksListHandlerPatch,
    }
};
```

### Adding Listening Events

If you need to add extra events/actions for triggering your handler, this is done with *ON_EVENTS* constant in [src/auto-me-bot.js](src/auto-me-bot.js):

```javascript
const ON_EVENTS = Object.freeze([
    'pull_request.opened',
    'pull_request.edited',
    'pull_request.synchronize',
    'pull_request.closed',
    'pull_request.ready_for_review',
    'pull_request.reopened',
    'pull_request_review.submitted',
    'pull_request_review.edited',
    'pull_request_review.dismissed',
]);
```

> Note that adding events also requires updating the GitHub App's subscribed events on [github.com/settings/apps](https://github.com/settings/apps) and re-requesting approval from existing users. Contact the maintainers if this is required.

## Third-Party Tools

This project uses several automated tools:

- **auto-me-bot** - Automates PR checks (dogfooding!)
- **CodeRabbit** - AI code reviews
- **Codecov** - Test coverage reporting
- **Dependabot** - Dependency updates
- **Snyk** - Security vulnerability scanning
- **GitGuardian** - Secret detection

Most run automatically on PRs. Check their respective dashboards for detailed reports.

## Contributing Documentation

The documentation is built with [Python](https://www.python.org/)'s [MkDocs](https://www.mkdocs.org/). The sources are in [docs/](docs/), and the configuration file is [mkdocs.yml](mkdocs.yml).

Useful commands:

- `pip install -r requirements.txt` — install dependencies required for building/serving the documentation site
- `mkdocs build` — build the documentation site in a folder named *site* (gitignored)
- `mkdocs serve` — serve the documentation site locally while watching the sources and auto-loading for modifications

> Using [venv](https://docs.python.org/3/tutorial/venv.html) is highly recommended.

[husky]: https://typicode.github.io/husky/
[lint-staged]: https://github.com/okonet/lint-staged
[context]: https://probot.github.io/api/latest/classes/context.Context.html
[checks-create]: https://docs.github.com/en/rest/checks/runs#create-a-check-run
[checks-update]: https://docs.github.com/en/rest/checks/runs#update-a-check-run
