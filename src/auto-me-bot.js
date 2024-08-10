import yaml from 'js-yaml'

// import handlers
import prAutoApproveHandler from './handlers/pr-auto-approve.js'
import prConventionalCommitsHandler from './handlers/pr-conventional-commits.js'
import prConventionalTitleHandler from './handlers/pr-conventional-title.js'
import prLifecycleLabelsHandler from './handlers/pr-lifecycle-labels.js'
import prSignedCommitsHandler from './handlers/pr-signed-commits.js'
import prTasksListHandler from './handlers/pr-tasks-list.js'

/* example configuration (for reference):
pr:
    autoApprove:
        ...
    conventionalCommits:
        ...
    conventionalTitle:
        ...
    lifecycleLabels:
        ...
    signedCommits:
        ...
    tasksList:
        ...
*/

// all triggering events should be listed here
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

// handler object should export two function, match and run
// the match function should take a context and return true if it can handle its payload
// the run function should take context, config, and an iso startedAt (config is nullable)
const CONFIG_SPEC = Object.freeze({
    pr: {
        autoApprove: prAutoApproveHandler,
        conventionalCommits: prConventionalCommitsHandler,
        conventionalTitle: prConventionalTitleHandler,
        lifecycleLabels: prLifecycleLabelsHandler,
        signedCommits: prSignedCommitsHandler,
        tasksList: prTasksListHandler,
    }
});

// main entrance point for probot
export default function (probot) {
    probot.on(ON_EVENTS, handlersController(CONFIG_SPEC));
};

// distributes handler invocations based on user config and config spec
export function handlersController(configSpec) {
    return async context => {
        // get config from current repo .github folder or from the .github repo's .github folder
        let config = await context.config('auto-me-bot.yml');
        console.info('CONTEXT\n' + JSON.stringify(context, null, 2));
        console.info('CONFIG\n' + yaml.dump(config));
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
                    if (currentHandlerSpec.match(context)) {
                        // invoke current handler
                        invocations.push(currentHandlerSpec.run(context, currentHandlerConfig, startedAt));
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
