import lint from '@commitlint/lint'
import load from '@commitlint/load'
import { EOL } from 'node:os'

/* example configuration (for reference):
rules:
    'header-max-length': [2, 'always', 80]
*/

const BOT_CHECK_URL = 'https://auto-me-bot.tomfi.info';
const CHECK_NAME = 'Auto-Me-Bot Conventional PR Title';
const DEFAULT_CONFIG = {extends: ['@commitlint/config-conventional']};

export default {match, run}

// matcher for picking up events
function match(context) {
    let event = 'pull_request';
    let actions = ['opened', 'edited', 'synchronize'];
    return event in context.payload ? actions.includes(context.payload.action) : false;
}

// handler for verifying pr titles as conventional
async function run(context, config, startedAt) {
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
            title: 'Nice!',
            summary: 'Good job, the PR title is conventional'
        }
    };
    let opts = await loadOptions(config);
    let lintReport = await lint(context.payload.pull_request.title, opts.rules, opts.parserPreset.parserOpts);
    if(!lintReport.valid) {
        // found error, warnings might be included as well
        report.conclusion = 'failure';
        report.output.title = 'Not conventional';
        report.output.summary = 'The PR title is not conventional';
        report.output.text = lintReportToMdReport(lintReport);
    } else if (lintReport.warnings.length > 0) {
        // found only warnings
        report.output.title = 'Got warnings';
        report.output.summary = 'The PR title is conventional, with warnings';
        report.output.text = lintReportToMdReport(lintReport);
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

// create markdown report from the lint report
function lintReportToMdReport(lintReport) {
    // create a report title
    let reportLines = [`### ${lintReport.input}`];
    // add warning table if warnings exist
    if (lintReport.warnings.length > 0) {
        reportLines.push(
            '#### Warnings',
            '| name | level | message |',
            '| - | - | - |'
        );
        lintReport.warnings.forEach(w => {
            reportLines.push(`| ${w.name} | ${w.level} | ${w.message} |`);
        });
    }
    // add error table if errors exist
    if (lintReport.errors.length > 0) {
        reportLines.push(
            '#### Errors',
            '| name | level | message |',
            '| - | - | - |'
        );
        lintReport.errors.forEach(e => {
            reportLines.push(`| ${e.name} | ${e.level} | ${e.message} |`);
        });
    }
    // return output as string
    return reportLines.join(EOL);
}

// load default and custom commitlint options
async function loadOptions (config) {
    if(config && config.rules) {
        return load({...DEFAULT_CONFIG, ...config});
    } else {
        return load(DEFAULT_CONFIG);
    }
}
