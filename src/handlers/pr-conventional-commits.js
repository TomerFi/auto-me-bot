const lint = require('@commitlint/lint').default;
const load = require('@commitlint/load').default;
const { EOL } = require('os');

/* example configuration (for reference):
rules:
    'body-max-line-length': [2, 'always', 150]
*/

const BOT_CHECK_URL = 'https://auto-me-bot.tomfi.info';
const CHECK_NAME = 'Auto-Me-Bot Conventional Commits';
const DEFAULT_CONFIG = {extends: ['@commitlint/config-conventional']};

// matcher for picking up events
module.exports.match = function(context) {
    let event = 'pull_request';
    let actions = ['opened', 'edited', 'synchronize'];
    return event in context.payload ? actions.includes(context.payload.action) : false;
}

// handler for verifying commit messages as conventional
module.exports.run =  async function(context, config, startedAt) {
    // create the initial check run and mark it as in_progress
    let checkRun = await context.octokit.checks.create(context.repo({
        head_sha: context.payload.pull_request.head.sha,
        name: CHECK_NAME,
        details_url: BOT_CHECK_URL,
        started_at: startedAt,
        status: 'in_progress'
    }));
    // default output for successful lint
    let report = {
        conclusion: 'success',
        output: {
            title: 'Good Job!',
            summary: 'Nothing to do here, no one told me you\'re a commit-message-master'
        }
    };
    // get the commits associated with the PR
    let commitObjs = [];
    await context.octokit.rest.pulls.listCommits(context.pullRequest()) // TODO: do we need "rest" here?
        .then(response => {
            if (response.status === 200) {
                commitObjs = response.data;
            } else {
                let {status, message} = response;
                console.error({status,  message});
            }
        })
        .catch(error => console.error(error));
    if (commitObjs.length === 0) {
        report.conclusion = 'failure'
        report.output.title = 'No commits found'
        report.output.summary = 'Unable to fetch commits from GH API'
    } else {
        // load the configuration options
        let opts = await loadOptions(config);
        // get lint status for every commit
        let lintStatuses = await commitObjs.map(commitObj => lintCommit(commitObj, opts));
        // list warning and error statuses
        let errorStatuses = [];
        let warningStatuses = [];
        await Promise.all(lintStatuses).then(statuses => statuses.forEach(status => {
            if(!status.report.valid) {
                errorStatuses.push(status); // the lint status is not valid
            } else if (status.report.warnings.length > 0) {
                warningStatuses.push(status); // the lint status is valid but has warnings
            }
        }));
        // check for error and warning
        let numError = errorStatuses.length;
        let numWarnings = warningStatuses.length;
        if (numError > 0) {
            // found errors
            report.conclusion = 'failure';
            let title;
            if (numWarnings > 0) {
                // found errors and warnings
                let totalFound = numError + numWarnings;
                title = `Found ${totalFound} non-conventional commit message${totalFound > 1 ? 's' : ''}`;

            } else {
                // found only errors - no warnings
                title = `Found ${numError} non-conventional commit message${numError > 1 ? 's' : ''}`;
            }
            // create output for error/error+warning
            report.output.title = title;
            report.output.summary = 'We need to amend these commits messages';
            report.output.text = errorStatuses.concat(warningStatuses).map(lintSts => parseLintStatus(lintSts)).join(EOL);
        } else if (numWarnings > 0) {
            // found only warning - no errors
            report.output.title = `Found ${numWarnings} non-conventional commit message${numWarnings > 1 ? 's' : ''}`;
            report.output.summary = 'Take a look at these';
            report.output.text = warningStatuses.map(lintSts => parseLintStatus(lintSts)).join(EOL);
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

// create markdown segments for aggregating the lint status report
function parseLintStatus(lintStatus) {
    // create title from commit msg and link
    let statusLines = [
        `### ${lintStatus.commits_url}`,
        '```',
        lintStatus.report.input,
        '```'
    ];
    // add warning table if warnings exist
    if (lintStatus.report.warnings.length > 0) {
        statusLines.push(
            '#### Warnings',
            '| name | level | message |',
            '| - | - | - |'
        );
        lintStatus.report.warnings.forEach(w => {
            statusLines.push(`| ${w.name} | ${w.level} | ${w.message} |`);
        });
    }
    // add error table if errors exist
    if (lintStatus.report.errors.length > 0) {
        statusLines.push(
            '#### Errors',
            '| name | level | message |',
            '| - | - | - |'
        );
        lintStatus.report.errors.forEach(e => {
            statusLines.push(`| ${e.name} | ${e.level} | ${e.message} |`);
        });
    }
    // return output as string
    return statusLines.join(EOL);
}

// load default and custom commitlint options
async function loadOptions (config) {
    if(config && config.rules) {
        return load({...DEFAULT_CONFIG, ...config});
    } else {
        return load(DEFAULT_CONFIG);
    }
}

// lint commit and return url and report
async function lintCommit(commitObj, opts) {
    return {
        commits_url: commitObj.html_url,
        report: await lint(commitObj.commit.message, opts.rules, opts.parserPreset.parserOpts)
    };
}
