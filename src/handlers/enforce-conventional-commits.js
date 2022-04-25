const load = require('@commitlint/load').default;
const lint = require('@commitlint/lint').default;

const DEFAULT_CONFIG = {
    extends: ['@commitlint/config-conventional'],
};

const CHECK_NAME = 'Auto-Me-Bot Conventional Commits';
const BOT_URL = 'https://github.com/TomerFi/auto-me-bot';

module.exports = enforceConventionalCommits;

/**
 * @param {import Context from 'probot'} context
 */
async function enforceConventionalCommits(context) {
    let startedAt = new Date().toISOString();
    let checkRun = await context.octokit.checks.create(context.repo({
        head_sha: context.payload.pull_request.head.sha,
        name: CHECK_NAME,
        details_url: BOT_URL,
        started_at: startedAt,
        status: 'in_progress'
    }));

    let commitObjs = await context.octokit.rest.pulls.listCommits(context.repo({
        pull_number: context.payload.pull_request.number
    })).then(resp => resp.data);


    let opts = await load(DEFAULT_CONFIG);

    let lintStatuses = await commitObjs.map(async commitObj => {
        return {
            commits_url: commitObj.html_url,
            report: await lint(commitObj.commit.message, opts.rules, opts.parserPreset ? {parserOpts: opts.parserPreset.parserOpts} : {})
        };
    });

    let errorStatuses = [];
    let warningStatuses = [];
    await Promise.all(lintStatuses).then(statuses => statuses.forEach(status => {
        if(!status.report.valid) {
            errorStatuses.push(status);
        } else if (status.report.warnings.length > 0) {
            warningStatuses.push(status);
        }
    }));

    let finalConclusion = 'success';
    let outputReport = {
        title: 'Good Job!',
        summary: 'Nothing to do here, no one told me you\'re a commit-message-master'
    };

    let numError = errorStatuses.length;
    let numWarnings = warningStatuses.length;
    if (numError > 0) {
        finalConclusion = 'failure';
        let reportSummary;
        if (numWarnings > 0) {
            reportSummary = `Oops, looks like we got ${numError} errors, and ${numWarnings} warnings`;
        } else {
            reportSummary = `Oops, looks like we got ${numError} non-conventional commit message${numError > 1 ? 's' : ''}`;
        }
        outputReport = {
            title: 'Linting Failed',
            summary: reportSummary,
            text: errorStatuses.concat(warningStatuses).map(lintSts => parseLintStatus(lintSts)).join('\r\n')
        };
    } else if (numWarnings > 0) {
        outputReport = {
            title: 'Linting Found Warnings',
            summary: `Hmmm... we got ${numWarnings} warning${numWarnings > 1 ? 's' : ''} you might want to look at`,
            text: warningStatuses.map(lintSts => parseLintStatus(lintSts)).join('\r\n')
        };
    }

    await context.octokit.checks.update(context.repo({
        check_run_id: checkRun.data.id,
        name: CHECK_NAME,
        details_url: BOT_URL,
        started_at: startedAt,
        status: 'completed',
        conclusion: finalConclusion,
        completed_at: new Date().toISOString(),
        output: outputReport
    }));
}

function parseLintStatus(lintStatus) {
    let statusLines = [
        `### ${lintStatus.commits_url}`,
        '```',
        lintStatus.report.input,
        '```'
    ];
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

    return statusLines.join('\r\n');
}
