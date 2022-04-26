const enforceConventionalCommits = require('./handlers/enforce-conventional-commits');
const enforceTasksList = require('./handlers/enforce-tasks-list');

/**
 * @param {import Probot from 'probot'} probot
 */
function autoMeBot(probot) {
    [enforceConventionalCommits, enforceTasksList]
        .forEach(handler => probot.on(
            [
                'pull_request.opened',
                'pull_request.edited',
                'pull_request.synchronize'
            ],
            handler));
}

module.exports = autoMeBot;
