const enforceConventionalCommits = require('./handlers/enforce-conventional-commits');

/**
 * @param {import Probot from 'probot'} probot
 */
function autoMeBot(probot) {
    probot.on(
        [
            'pull_request.opened',
            'pull_request.edited',
            'pull_request.synchronize'
        ],
        enforceConventionalCommits);
}

module.exports = autoMeBot;
