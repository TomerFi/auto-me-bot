const yaml = require('js-yaml');

// import handlers
const prConventionalCommitsHandler = require('./handlers/pr-conventional-commits');
const prSignedCommitsHandler = require('./handlers/pr-signed-commits');
const prTasksListHandler = require('./handlers/pr-tasks-list');

// all triggering events should be listed here
const ON_EVENTS = [
    'pull_request.opened',
    'pull_request.edited',
    'pull_request.synchronize'
];

// handler functions should take context, config, and an iso startedAt
/* example configuration (for reference):
pr:
    conventionalCommits:
        ...
    signedCommits:
        ...
    tasksList:
        ...
*/
const CONFIG_SPEC = {
    pr: {
        conventionalCommits: {
            event: 'pull_request',
            actions: ['opened', 'edited', 'synchronize'],
            run: () => prConventionalCommitsHandler,
        },
        signedCommits: {
            event: 'pull_request',
            actions: ['opened', 'edited', 'synchronize'],
            run: () => prSignedCommitsHandler,
        },
        tasksList: {
            event: 'pull_request',
            actions: ['opened', 'edited', 'synchronize'],
            run: () => prTasksListHandler,
        },
    }
};

// distributes handler invocations based on user config and config spec
function handlersController(configSpec) {
    return async context => {
        // get config from current repo .github folder or from the .github repo's .github folder
        let config = await context.config('auto-me-bot.yml');
        console.log('CONTEXT\n' + JSON.stringify(context, null, 2));
        console.log('CONFIG\n' + yaml.dump(config));
        let invocations = []
        let startedAt = new Date().toISOString();
        // iterate over user config keys, i.e. "pr"
        for (let configType in config) {
            let currentConfig = config[configType];
            let currentConfigSpec = configSpec[configType];
            // iterate over handler types, i.e. "tasksList"
            for (let handlerType in currentConfig) {
                // verify we have a spec for the config
                if (handlerType in currentConfigSpec) {
                    let currentHandlerConfig = currentConfig[handlerType]; // nullable
                    let currentHandlerSpec = currentConfigSpec[handlerType];
                    // verify the handler matches the current event and action types
                    if (currentHandlerSpec.event in context.payload) {
                        if (currentHandlerSpec.actions.includes(context.payload[currentHandlerSpec.event].action)) {
                            // invoke current handler
                            invocations.push(currentHandlerSpec.run()(context, currentHandlerConfig, startedAt));
                        }
                    }

                }
            }
        }
        if (invocations) {
            // wait for all handlers to be settled
            await Promise.allSettled(invocations);
        }
    }
}

module.exports = function (probot) {
    probot.on(ON_EVENTS, handlersController(CONFIG_SPEC));
};
