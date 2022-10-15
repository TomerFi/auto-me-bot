# Contributing to <em>auto-me-bot</em>

:clap: First off, thank you for taking the time to contribute. :clap:

- Fork the repository
- Create a new branch
- Commit your changes
- Create a pull request against the `main` branch

## Project walk through

*auto-me-bot* was created around the concept of *handlers* and *config types*.<br/>
A *config type* is the type of *GitHub* event, i.e. *pr*, a *handler* represents an operation supported for a *config type*.<br/>
At the time of writing this, we have handlers only for the *pr* config type, exemplified best in the configuration YAML:

```yaml
pr:
  conventionalCommits:
  conventionalTitle:
  lifecycleLabels:
  signedCommits:
  tasksList:
```

## Contributing Code

### Build commands

- `npm install` install all dependencies
- `npm test` run the unit tests and verify code coverage
- `npm run tests` run the tests with no code coverage verification
- `npm run tests:rep` run the tests with no code coverage verification and create *unit-tests-result.json*
- `npm run lint` linting the project

### Developing Handlers

All handlers are located in [src/handlers/](https://github.com/TomerFi/auto-me-bot/tree/main/src/handlers).<br/>
Handlers **MUST** export 2 functions (snippets source is the [pr-conventional-title handler](https://github.com/TomerFi/auto-me-bot/blob/main/src/handlers/pr-conventional-title.js)):

A *match* function that will be used for matching incoming events, it takes [probot's context](https://probot.github.io/api/latest/classes/context.Context.html) and expected to return a boolean indicating whether or not the handler can handle the current request, typically based on the event type and supported actions:

```javascript
module.exports.match = function(context) {
    let event = 'pull_request';
    let actions = ['opened', 'edited'];
    return event in context.payload ? actions.includes(context.payload.action) : false;
}
```

A *run* function that will be used for handling a request, it will be invoked only if the aforementioned *match* function returns *true*, it takes [probot's context](https://probot.github.io/api/latest/classes/context.Context.html), the configuration for handler, and an *ISO8601 timestamp* marking the start timestamp of the handler run:

> Note that *config* contains the running handler configuration **only**, and not configuration of other handlers.

```javascript
module.exports.run =  async function(context, config, startedAt) {
  // ...
}
```

For pull requests, the run function is expected, to [create a check-run](https://docs.github.com/en/rest/checks/runs#create-a-check-run) right off its invocation, and mark its *status* as *in_progress*:

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

The *run* function, is also expected, as a final stage, to [update the previously created check-run](https://docs.github.com/en/rest/checks/runs#update-a-check-run), and mark its *status* as *completed*, use the *conclusion* key to relay the check-run result:

```javascript
module.exports.run =  async function(context, config, startedAt) {

    let checkRun = await context.octokit.checks.create(context.repo({
        head_sha: context.payload.pull_request.head.sha,
        name: CHECK_NAME,
        details_url: BOT_CHECK_URL,
        started_at: startedAt,
        status: 'in_progress'
    }));

    // HANDLER OPERATIONS GOES HERE

    await context.octokit.checks.update(context.repo({
        check_run_id: checkRun.data.id,
        name: CHECK_NAME,
        details_url: BOT_CHECK_URL,
        started_at: startedAt,
        status: 'completed',
        completed_at: new Date().toISOString(),
        conclusion: 'success',
        output: {
            title: 'Nice!',
            summary: 'Good job, the PR title is conventional'
        }
    }));
}
```

### Testing Handlers

All handler unit tests are located in [tests/handlers/](https://github.com/TomerFi/auto-me-bot/tree/main/tests/handlers), test the *match* and *run* functions individually, you can inject fakes and stubs into these and verify their behavior.<br/>
Take note of [pr-conventional-title test cases](https://github.com/TomerFi/auto-me-bot/blob/main/tests/handlers/pr-conventional-title.test.js) which can be used as a template for future test cases as it's quite short, simple, and has full coverage.

### Registering Handlers

> NOTE: registering handlers requires modifying existing code, the snippets in this section are meant to help you get around the code, and to be used as boiler-plate code.

Registration of new handler is done in [src/auto-me-bot.js](https://github.com/TomerFi/auto-me-bot/blob/main/src/auto-me-bot.js).<br/>
Add an import for the new handler, look for the *CONFIG_SPEC* constant, add your configuration key, and point it the imported handler:

```javascript
const CONFIG_SPEC = Object.freeze({
    pr: {
        conventionalCommits: prConventionalCommitsHandler,
        conventionalTitle: prConventionalTitleHandler,
        lifecycleLabels: prLifecycleLabelsHandler,
        signedCommits: prSignedCommitsHandler,
        tasksList: prTasksListHandler,
    }
});
```

### Testing Handlers Registration

Handlers registration is already tested, you only need to instruct it to also include the new handler when doing invocation testing in 3 simple steps, all done in [tests/auto-me-bot.test.js](https://github.com/TomerFi/auto-me-bot/blob/main/tests/auto-me-bot.test.js).

#### Create the patch

Look for the `beforeEach` function, instantiate your stub and create the patch, i.e.:

```javascript
// patch the conventionalTitle handler's run function to a stub
conventionalTitleHandlerStub = sinon.stub();
let conventionalTitleHandlerPatch = {
    match: require('../src/handlers/pr-conventional-title').match,
    run: conventionalTitleHandlerStub
};
```

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

If you need to add extra events/actions for triggering your handler, this is done with *ON_EVENTS* constant in [src/auto-me-bot.js](https://github.com/TomerFi/auto-me-bot/blob/main/src/auto-me-bot.js):

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

> Note that adding events also requires updating the running application settings and requesting existing users approval, please contact the maintainers if this is required.

## Contributing Documentation

The documentation is built with [Python](https://www.python.org/)'s [MkDocs](https://www.mkdocs.org/).
The sources are in [docs/](https://github.com/TomerFi/auto-me-bot/tree/main/docs), and the configuration file is [mkdocs.yml](https://github.com/TomerFi/auto-me-bot/blob/main/mkdocs.yml).

Useful commands:

- `pip install -r requirements.txt` install dependencies required for building/serving the documentation site
- `mkdocs build` build the documentation site in a folder named *site* (gitignored)
- `mkdocs serve` serve the documentation site locally while watching the sources and auto loading for modifications

> Using [venv](https://docs.python.org/3/tutorial/venv.html) is highly recommended.
