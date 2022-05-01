'use strict';

const emailVerifier = require('@digitalroute/email-verify');
const { EOL } = require('os');

const BOT_CHECK_URL = 'https://auto-me-bot.tomfi.info';
const CHECK_NAME = 'Auto-Me-Bot Signed Commits';

const SIGN_OFF_TRAILER_REGEX = /^Signed-off-by: (.*) <(.*)@(.*)>$/;

module.exports = handleSignedCommits;

/*
# example auto-me-bot.yml configuration
pr:
    signedCommits:
*/

// handler for verifying all commits are sign with the Signed-off-by trailer and a legit email
async function handleSignedCommits(context, _config, startedAt) {
    // create the initial check run and mark it as in_progress
    let checkRun = await context.octokit.checks.create(context.repo({
        head_sha: context.payload.pull_request.head.sha,
        name: CHECK_NAME,
        details_url: BOT_CHECK_URL,
        started_at: startedAt,
        status: 'in_progress'
    }));

    // grab all commits related the pr
    let allCommits = await context.octokit.rest.pulls.listCommits(context.pullRequest())
        .then(resp => resp.data);

    // list all unsigned commits
    var unsignedCommits = [];
    await Promise.all(allCommits.map(commit =>
        verifyCommitTrailer(commit.commit).catch(() => unsignedCommits.push(commit))))

    // default output when all commits are signed
    let finalConclusion = 'success';
    let outputReport = {
        title: 'Well Done!',
        summary: 'All commits are signed'
    }

    let numUnsignedCommits = unsignedCommits.length;
    if (numUnsignedCommits > 0) {
        // if found unsigned commit/s update output
        finalConclusion = 'failure';
        outputReport = {
            title: `Found ${numUnsignedCommits} unsigned commits`,
            summary: 'We need to get the these commits signed',
            text: unsignedCommits.map(commit => `- ${commit.html_url}`).join(EOL)
        }
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

// verify a commit message have a 'Signed-off-by' trailer correlating with the commits' author/committer
async function verifyCommitTrailer(commit) {
    // list all 'Signed-off-by' trailers matching the author or committer
    var trailerMatches = []
    commit.message.split(EOL).forEach(line => {
        let match = line.match(SIGN_OFF_TRAILER_REGEX);
        if (match !== null) {
            let signed = { name: match[1], email: `${match[2]}@${match[3]}` };
            if (
                (signed.name === commit.author.name && signed.email === commit.author.email) // signed by author
                || (signed.name === commit.committer.name && signed.email === commit.committer.email) // signed by committer
            ) {
                trailerMatches.push(signed);
            }
        }
    });
    // reject if none found
    if (trailerMatches.length === 0) {
        return Promise.reject();
    }
    // verify all 'Signed-off-by' are legit emails
    return Promise.all(trailerMatches.map(match =>
        emailVerifier.verify(match.email, (err, info) => {
            if (err || info.code !== emailVerifier.verifyCodes.finishedVerification) {
                return Promise.reject();
            }
        })));
}
