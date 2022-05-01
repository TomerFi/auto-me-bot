'use strict';

const prConventionalCommitsHandler = require('./handlers/pr-conventional-commits');
const prSignedCommitsHandler = require('./handlers/pr-signed-commits');
const prTasksListHandler = require('./handlers/pr-tasks-list');

module.exports = autoMeBot;

/* ######################################## ##
## #### Pull request related constants #### ##
## ######################################## */
const PR_EVENTS = [
    'pull_request.opened',
    'pull_request.edited',
    'pull_request.synchronize'
];
const PR_HANDLERS = { // pr handlers should take context, config, and iso startedAt
    conventionalCommits: () => prConventionalCommitsHandler,
    signedCommits: () => prSignedCommitsHandler,
    tasksList: () => prTasksListHandler
};
const PR_PREDICATE = (config, context) => 'pr' in config || 'pull_request' in context.payload;

/* ################################################### ##
## #### Main exported function registering events #### ##
## ################################################### */
function autoMeBot(probot) {
    probot.on(PR_EVENTS, handlersController(PR_PREDICATE, PR_HANDLERS));
}

/* ################################################################ ##
## #### Distributes handler invocations based on configuration #### ##
## ################################################################ */
function handlersController(predicate, handlers) {
    return async context => {
        // get config from current repo .github folder or from the .github repo's .github folder
        let config = await context.config('auto-me-bot.yml');
        if (config && predicate(config, context)) {
            // if the predicate passes, invoke the handler from the map based on the config key
            let invocations = []
            let startedAt = new Date().toISOString();
            for (let key in config.pr) {
                invocations.push(handlers[key]()(context, config, startedAt));
            }
            await Promise.allSettled(invocations);
        }
    }
}
