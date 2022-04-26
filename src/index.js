const enforceConventionalCommits = require('./handlers/enforce-conventional-commits');
const enforceTasksList = require('./handlers/enforce-tasks-list');

module.exports = autoMeBot;

function autoMeBot(probot) {
    probot.onAny(handlerController);
}

async function handlerController(context) {
    // get config from current repo .github folder or from the .github repo's .github folder
    let config = await context.config('auto-me-bot.yml');
    if (config === null) {
        return;
    }
    let startedAt = new Date().toISOString();
    // pull request handlers
    if (
        Object.prototype.hasOwnProperty.call(config, 'pr')
        && Object.prototype.hasOwnProperty.call(context.payload, 'pull_request')
    ) {
        if (Object.prototype.hasOwnProperty.call(config.pr, 'conventionalCommits')) {
            if (['opened', 'edited', 'synchronize'].includes(context.payload.action)) {
                enforceConventionalCommits(context, config, startedAt);
            }
        }
        if (Object.prototype.hasOwnProperty.call(config.pr, 'tasksList')) {
            if (['opened', 'edited', 'synchronize'].includes(context.payload.action)) {
                enforceTasksList(context, config, startedAt);
            }
        }
    }
}
