const { difference, isEmpty, union } = require('lodash');

const BOT_CHECK_URL = 'https://auto-me-bot.tomfi.info';
const CHECK_NAME = 'Auto-Me-Bot Lifecycle Labels';

const LABEL_KEYS = Object.freeze({
    REVIEW_REQUIRED: 'reviewRequired',
    CHANGES_REQUESTED: 'changesRequested',
    MORE_REVIEWS_REQUIRED: 'moreReviewsRequired',
    REVIEW_STARTED: 'reviewStarted',
    APPROVED: 'approved',
    MERGED: 'merged',
});


const KNOWN_LABELS = Object.freeze(Object.values(LABEL_KEYS));

/* example configuration (for reference):
pr:
    lifecycleLabels:
        labels:
            reviewRequired: "status: needs review"
            changesRequested: "status: changes requested"
            moreReviewsRequired: "status: needs more reviews"
            reviewStarted: "status: review started"
            approved: "status: approved"
            merged: "status: merged"
*/


// handler for labeling pull requests based on lifecycle
module.exports = async function(context, config, startedAt) {
    // create the initial check run and mark it as in_progress
    let checkRun = await context.octokit.checks.create(context.repo({
        head_sha: context.payload.pull_request.head.sha,
        name: CHECK_NAME,
        details_url: BOT_CHECK_URL,
        started_at: startedAt,
        status: 'in_progress'
    }));

    // default output for successful labeling
    let report = {
        finalConclusion: 'success',
        outputReport: {
            title: 'All Done!',
            summary: 'Pull request labeled'
        }
    };

    await workThemLabels(context, config, report);

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


function verifyConfiguration(config) {
    return !isEmpty(config) && !isEmpty(config.labels) && KNOWN_LABELS.some(lk => KNOWN_LABELS.includes(lk));
}

function getConfiguredLabels(labels) {
    return Object.fromEntries(Object.entries(labels).filter(kv => KNOWN_LABELS.includes(kv[0])));
}

async function getLifecycleLabel(context) {
    let action = context.payload.action;
    let isMerged = context.payload.pull_request.merged;

    if (action === 'closed' && isMerged) {
        return LABEL_KEYS.MERGED;
    }

    let reviews = await context.octokit.pulls.listReviews(context.pullRequest())
        .then(resp => resp.data);

    if (reviews.length === 0) {
        return LABEL_KEYS.REVIEW_REQUIRED;
    }

    let approvals = 0;
    reviews.forEach(review => {
        if (review.state === 'CHANGES_REQUESTED') {
            return LABEL_KEYS.CHANGES_REQUESTED;
        }
        if (review.state === 'APPROVED') {
            approvals++;
        }
    });

    if (approvals === 0) {
        return LABEL_KEYS.REVIEW_STARTED;
    }

    let baseProtections = await context.octokit.repos.getBranchProtection(
        context.repo({branch: context.payload.pull_request.base.sha})).then(resp => resp.data);

    let requiredApprovals = baseProtections?.required_pull_request_reviews?.required_approving_review_count;
    if (approvals < requiredApprovals) {
        return LABEL_KEYS.MORE_REVIEWS_REQUIRED;
    }
    return LABEL_KEYS.APPROVED;
}

async function workThemLabels(context, config, report) {
    if (verifyConfiguration(config)) {
        let configuredLabels = getConfiguredLabels(config.labels);
        let lifecycleLabel = await getLifecycleLabel(context);

        if (!configuredLabels.includes(lifecycleLabel)) {
            report.outputReport.summary = 'Lifecycle label not configured.';
            return;
        }

        let addLabel = configuredLabels[lifecycleLabel];
        let removeLabels = KNOWN_LABELS.filter(l => l !== lifecycleLabel).map(l => configuredLabels[l]);

        let prLabels = context.payload.pull_request.labels.map(l => l.name);
        if (!prLabels.includes(addLabel)) {
            let labelExist = await context.octokit.issues.getLabel(context.pullRequest({name: addLabel}))
                .then(resp => resp.code === 200);
            if (!labelExist) {
                report.finalConclusion = 'failure';
                report.outputReport.title = `Label for ${lifecycleLabel} not found`;
                report.outputReport.summary = `Are you sure the ${addLabel} exists?`;
                return;
            }
        }

        let targetLabels = union(prLabels.filter(l => !(removeLabels.includes(l))), addLabel);

        if (!isEmpty(difference(prLabels, targetLabels))) {
            await context.octokit.issues.addLabels(context.pullRequest({names: targetLabels}))
                .then(resp => {
                    if (resp.code !== 200) {
                        report.finalConclusion = 'failure';
                        report.outputReport.title = 'Failed to add the label';
                        report.outputReport.summary = 'This might be an internal time out, please try again';
                    }
                });
        }
    } else {
        // the configuration is not valid
        report.finalConclusion = 'neutral';
        report.outputReport.title = 'Nothing for me to do.';
        report.outputReport.summary = 'Are you sure your configuration is valid?';
    }
}
