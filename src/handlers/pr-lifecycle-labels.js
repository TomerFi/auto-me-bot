const { isEmpty } = require('lodash');

/* example configuration (for reference):
ignoreDrafts: true
labels:
    reviewRequired: "status: needs review"
    changesRequested: "status: changes requested"
    moreReviewsRequired: "status: needs more reviews"
    reviewStarted: "status: review started"
    approved: "status: approved"
    merged: "status: merged"
*/

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

// matcher for picking up events
module.exports.match = function(context) {
    let eventPr = 'pull_request';
    let actionsPr = ['opened', 'edited', 'synchronize', 'closed', 'ready_for_review', 'reopened'];

    let eventPrReview = 'review';
    let actionsPrReview = ['submitted', 'edited', 'dismissed'];

    // keep this switch before the next one
    if (eventPrReview in context.payload) {
        return actionsPrReview.includes(context.payload.action);
    }

    if (eventPr in context.payload) {
        return actionsPr.includes(context.payload.action);
    }
    return false;
}

// handler for labeling pull requests based on lifecycle
module.exports.run = async function(context, config, startedAt) {
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
        conclusion: 'success',
        output: {
            title: 'All Done!',
            summary: 'Pull request labeled'
        }
    };

    if (config?.ignoreDrafts && context.payload.pull_request.draft) {
        report.conclusion = 'skipped'
        report.output.title = 'Ignoring drafts'
        report.output.summary = 'I\'m configured to ignore drafts';
    } else if (!verifyConfiguration(config)) {
        report.conclusion = 'neutral';
        report.output.title = 'Nothing for me to do';
        report.output.summary = 'Are you sure your configuration is valid?';
    } else {
        await workThemLabels(context, config, report);
    }

    //  update check run and mark it as completed
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
    if (isEmpty(config) || isEmpty(config.labels)) {
        return false;
    }
    let optionalLabelKeys = Object.keys(config?.labels);
    return KNOWN_LABELS.some(lk => optionalLabelKeys.includes(lk));
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

    let reviews = [];
    await context.octokit.pulls.listReviews(context.pullRequest())
        .then(response => {
            if (response.status === 200) {
                reviews = response.data;
            } else {
                let {status, message} = response;
                console.error({status,  message});
            }
        })
        .catch(error => console.error(error));

    if (reviews.length === 0) {
        return LABEL_KEYS.REVIEW_REQUIRED;
    }

    let changeRequests = 0;
    let approvals = 0;
    Object.values(reviews.reduce((finalReviews, currentReview) => {
        // get the latest review per user_login+commit_id
        let key = `${currentReview.user.login}-${currentReview.commit_id}`;
        if (finalReviews && finalReviews[key]) {
            let existing = new Date(finalReviews[key].submitted_at).getTime();
            let current = new Date(currentReview.submitted_at).getTime();
            if (current > existing) {
                finalReviews[key] = currentReview;
            }
        } else {
            finalReviews[key] = currentReview;
        }
        return finalReviews;
    }, {})).forEach(review => {
        if (review.state === 'CHANGES_REQUESTED') {
            changeRequests++;
        }
        if (review.state === 'APPROVED') {
            approvals++;
        }
    });

    if (changeRequests > 0) {
        return LABEL_KEYS.CHANGES_REQUESTED;
    }

    if (approvals === 0) {
        return LABEL_KEYS.REVIEW_STARTED;
    }

    let baseProtections;
    await context.octokit.repos.getBranchProtection(context.repo({branch: context.payload.pull_request.base.ref}))
        .then(response => {
            if (response.status === 200){
                baseProtections = response.data;
            } else {
                let {status, message} = response;
                console.error({status,  message});
            }
        })
        .catch(error => console.error(error));

    let requiredApprovals = baseProtections?.required_pull_request_reviews?.required_approving_review_count || 0;
    if (approvals < requiredApprovals) {
        return LABEL_KEYS.MORE_REVIEWS_REQUIRED;
    }
    return LABEL_KEYS.APPROVED;
}

async function workThemLabels(context, config, report) {
    let configuredLabels = getConfiguredLabels(config.labels);
    let lifecycleLabel = await getLifecycleLabel(context);

    if (!(lifecycleLabel in configuredLabels)) {
        report.output.title = 'Label not configured'
        report.output.summary = `Lifecycle label '${lifecycleLabel}' not configured`;
        return;
    }

    let addLabel = configuredLabels[lifecycleLabel];
    let prLabels = context.payload.pull_request.labels.map(l => l.name);
    let removeLabels = KNOWN_LABELS
        .filter(l => l !== lifecycleLabel)
        .filter(l => l in configuredLabels)
        .map(l => configuredLabels[l])
        .filter(l => prLabels.includes(l));

    removeLabels.forEach(removeLabel =>
        context.octokit.issues.removeLabel(context.repo({issue_number: context.payload.pull_request.number, name: removeLabel}))
            .then(response => {
                if (response.status !== 200) {
                    let {status, message} = response;
                    console.error({status,  message});
                }
            })
            .catch(error => console.error(error)));

    if (!prLabels.includes(addLabel)) {
        let labelExist = false;
        await context.octokit.issues.getLabel(context.repo({name: addLabel}))
            .then(resp => labelExist = resp.status === 200)
            .catch(error => console.error(error));
        if (!labelExist) {
            report.conclusion = 'failure';
            report.output.title = `Label for '${lifecycleLabel}' not found`;
            report.output.summary = `Are you sure the '${addLabel}' label exists?`;
            return;
        }
        await context.octokit.issues.addLabels(context.repo({issue_number: context.payload.pull_request.number, labels: [addLabel]}))
            .then(resp => {
                if (resp.status !== 200) {
                    report.conclusion = 'failure';
                    report.output.title = 'Failed to add the label';
                    report.output.summary = 'This might be an internal time out, please try again';
                }
            })
            .catch(error => {
                console.error(error);
                report.conclusion = 'failure';
                report.output.title = 'Failed to add the label';
                report.output.summary = 'This might be a permissions issue';
            });
    }
}
