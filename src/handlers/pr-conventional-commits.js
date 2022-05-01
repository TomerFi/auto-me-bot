'use strict';

const lint = require('@commitlint/lint').default;
const load = require('@commitlint/load').default;
const { EOL } = require('os');


const BOT_CHECK_URL = 'https://auto-me-bot.tomfi.info';
const CHECK_NAME = 'Auto-Me-Bot Conventional Commits';
const DEFAULT_CONFIG = {
    extends: ['@commitlint/config-conventional'],
};

module.exports = handlePrConventionalCommits;

/*
# example auto-me-bot.yml configuration
pr:
    conventionalCommits:
*/

// handler for verifying commit messages as conventional
async function handlePrConventionalCommits(context, _config, startedAt) {
    // create the initial check run and mark it as in_progress
    let checkRun = await context.octokit.checks.create(context.repo({
        head_sha: context.payload.pull_request.head.sha,
        name: CHECK_NAME,
        details_url: BOT_CHECK_URL,
        started_at: startedAt,
        status: 'in_progress'
    }));
    // get the commits associated with the PR
    let commitObjs = await context.octokit.rest.pulls.listCommits(context.pullRequest())
        .then(resp => resp.data);
    // load the configuration options
    let opts = await load(DEFAULT_CONFIG);
    // get lint status for every commit
    let lintStatuses = await commitObjs.map(async commitObj => {
        return {
            commits_url: commitObj.html_url,
            report: await lint(commitObj.commit.message, opts.rules, opts.parserPreset.parserOpts)
        };
    });
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
    // default output for successful lint
    let finalConclusion = 'success';
    let outputReport = {
        title: 'Good Job!',
        summary: 'Nothing to do here, no one told me you\'re a commit-message-master'
    };
    // check of error and warning
    let numError = errorStatuses.length;
    let numWarnings = warningStatuses.length;
    if (numError > 0) {
        // found errors
        finalConclusion = 'failure';
        let reportSummary;
        if (numWarnings > 0) {
            // found errors and warnings
            reportSummary = `Oops, looks like we got ${numError} errors, and ${numWarnings} warnings`;
        } else {
            // found only errors - no warnings
            reportSummary = `Oops, looks like we got ${numError} non-conventional commit message${numError > 1 ? 's' : ''}`;
        }
        // create output for error/error+warning
        outputReport = {
            title: 'Linting Failed',
            summary: reportSummary,
            text: errorStatuses.concat(warningStatuses).map(lintSts => parseLintStatus(lintSts)).join(EOL)
        };
    } else if (numWarnings > 0) {
        // found only warning - no errors
        outputReport = {
            title: 'Linting Found Warnings',
            summary: `Hmmm... we got ${numWarnings} warning${numWarnings > 1 ? 's' : ''} you might want to look at`,
            text: warningStatuses.map(lintSts => parseLintStatus(lintSts)).join(EOL)
        };
    }
    // update check run and mark it as completed
    await context.octokit.checks.update(context.repo({
        check_run_id: checkRun.data.id,
        name: CHECK_NAME,
        details_url: BOT_CHECK_URL,
        started_at: startedAt,
        status: 'completed',
        conclusion: finalConclusion,
        completed_at: new Date().toISOString(),
        output: outputReport
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
