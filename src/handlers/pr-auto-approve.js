/* example configuration (for reference):
allBots: true
users: ['myUserName']
*/

const BOT_CHECK_URL = 'https://auto-me-bot.tomfi.info';
const CHECK_NAME = 'Auto-Me-Bot PR Automatic Approval';

// matcher for picking up events
module.exports.match = function(context) {
    let event = 'pull_request';
    let actions = ['opened', 'synchronize'];
    return event in context.payload ? actions.includes(context.payload.action) : false;
}

// handler for automatic approvals of PRs based on sender login and type
module.exports.run = async function(context, config, startedAt) {
    // create the initial check run and mark it as in_progress
    let checkRun = await context.octokit.checks.create(context.repo({
        head_sha: context.payload.pull_request.head.sha,
        name: CHECK_NAME,
        details_url: BOT_CHECK_URL,
        started_at: startedAt,
        status: 'in_progress'
    }));

    // default output for no auto approval required
    let report = {
        conclusion: 'neutral',
        output: {
            title: 'No automatic approval required',
            summary: 'Nothing for me to do here'
        }
    };

    if (config) {
        // if allBots is true and the user type is a bot
        if ((config.allBots && context.isBot())
            // if users list is configured and contains the sender login
            || (config.users && config.users.includes(
                context.payload.sender.login.replace('[bot]', '').trim()))
        ) {
            // send approve request
            await context.octokit.pulls.createReview(context.pullRequest({event: 'APPROVE'}))
                .then(response => {
                    if (response.status === 200) {
                        report.conclusion = 'success';
                        report.output.title = 'PR approved!';
                        report.output.summary = `${context.payload.sender.type} was automatically approved`;
                    } else {
                        let {status, message} = response;
                        console.error({status,  message});
                        report.conclusion = 'failure';
                        report.output.title = 'Failed to approve the PR';
                        report.output.summary = 'Automatically approval failed';
                        report.output.text = `Got status ${response.status}.`;
                    }
                })
                .catch(error => {
                    console.error(error);
                    report.conclusion = 'failure';
                    report.output.title = 'Failed to approve the PR';
                    report.output.summary = 'Automatically approval failed';
                    report.output.text = 'Got error.';
                });
        }
    }

    // update check run and mark it as completed
    await context.octokit.checks.update(context.repo({
        check_run_id: checkRun.data.id,
        name: CHECK_NAME,
        details_url: BOT_CHECK_URL,
        started_at: startedAt,
        status: 'completed',
        completed_at: new Date().toISOString(),
        ...report
    }));
}
