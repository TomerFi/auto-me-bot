const enforceConventionalCommits = require('./handlers/enforce-conventional-commits');
const enforceTasksList = require('./handlers/enforce-tasks-list');

module.exports = autoMeBot;

// pr events to monitor, action fine-grain should be performed at the handler level
const PR_EVENTS = [
    'pull_request.opened',
    'pull_request.edited',
    'pull_request.synchronize'
];
// map pr config keys to handlers, handlers should take context, config, and iso startedAt
const PR_HANDLERS = {
    'conventionalCommits': enforceConventionalCommits,
    'tasksList': enforceTasksList
};
// guard for pr, must pass for the handler to be invoke
const PR_PREDICATE = (config, context) =>
    config !== null || 'pr' in config || 'pull_request' in context.payload;

// main function - exported
function autoMeBot(probot) {
    probot.on(PR_EVENTS, handlersController(PR_PREDICATE, PR_HANDLERS));
}

// controller function, grabs the config, and if the guard passes, launches the related handlers
function handlersController(predicate, handlersMap) {
    return async function(context) {
        // get config from current repo .github folder or from the .github repo's .github folder
        let config = await context.config('auto-me-bot.yml');
        if (predicate(config, context)) {
            // if the predicate passes, invoke the handler from the map based on the config key
            let startedAt = new Date().toISOString();
            for (let key in config.pr) {
                handlersMap[key](context, config, startedAt);
            }
        }
    }
}
