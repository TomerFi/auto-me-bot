const emailVerifier = require('@digitalroute/email-verify');
const { EOL } = require('os');

/* example configuration (for reference):
ignore:
    users: ['notrealuser']
    emails: ['not.real@email.address']
*/

const BOT_CHECK_URL = 'https://auto-me-bot.tomfi.info';
const CHECK_NAME = 'Auto-Me-Bot Signed Commits';

const SIGN_OFF_TRAILER_REGEX = /^Signed-off-by: (.*) <(.*)@(.*)>$/;

// matcher for picking up events
module.exports.match = function(context) {
    let event = 'pull_request';
    let actions = ['opened', 'edited', 'synchronize'];
    return event in context.payload ? actions.includes(context.payload.action) : false;
}

// handler for verifying all commits are sign with the Signed-off-by trailer and a legit email
module.exports.run = async function(context, config, startedAt) {
    // create the initial check run and mark it as in_progress
    let checkRun = await context.octokit.checks.create(context.repo({
        head_sha: context.payload.pull_request.head.sha,
        name: CHECK_NAME,
        details_url: BOT_CHECK_URL,
        started_at: startedAt,
        status: 'in_progress'
    }));
    // default output when all commits are signed
    let report = {
        conclusion: 'success',
        output: {
            title: 'Well Done!',
            summary: 'All commits are signed'
        }
    };
    // grab all commits related the pr
    let allCommits = [];
    await context.octokit.rest.pulls.listCommits(context.pullRequest()) // TODO: do we need "rest" here?
        .then(response => {
            if (response.status === 200) {
                allCommits = response.data;
            } else {
                let {status, message} = response;
                console.error({status,  message});
            }
        })
        .catch(error => console.error(error));
    if (allCommits.length === 0) {
        report.conclusion = 'failure'
        report.output.title = 'No commits found'
        report.output.summary = 'Unable to fetch commits from GH API'
    } else {
        // list all unsigned commits
        let unsignedCommits = [];
        await Promise.all(allCommits.map(commit =>
            verifyCommitTrailer(commit.commit, config).catch(() => unsignedCommits.push(commit))))
        // check if found unsigned commits
        let numUnsignedCommits = unsignedCommits.length;
        if (numUnsignedCommits > 0) {
            // if found unsigned commit/s update output
            report.conclusion = 'failure';
            report.output.title = `Found ${numUnsignedCommits} unsigned commits`;
            report.output.summary = 'We need to get the these commits signed';
            report.output.text = unsignedCommits.map(commit => `- ${commit.html_url}`).join(EOL);
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

/*
 * if an email contains [bot] we assume it's a bot and skip his commits,
 * because bots are not very disciplined and sometimes do not signing up their commits.
 * there is also an option to ignore specific emails and user names in configurations
 * so for those we shall skip commits signing too.
*/
function shouldSkipCommit(commit, config) {
    if (commit.author.email.includes('[bot]')
    || commit.committer.email.includes('[bot]')){
        return true;
    }
    if (config && config.ignore) {
        if(config.ignore.emails){
            if (config.ignore.emails.includes(commit.author.email)
            || config.ignore.emails.includes(commit.committer.email)){
                return true;
            }
        }
        if(config.ignore.users){
            if (config.ignore.users.includes(commit.author.name)
            || config.ignore.users.includes(commit.committer.name)){
                return true;
            }
        }
    }
    return false;
}

// verify a commit message have a 'Signed-off-by' trailer correlating with the commits' author/committer
async function verifyCommitTrailer(commit, config) {
    // list all 'Signed-off-by' trailers matching the author or committer
    let trailerMatches = []
    // skip commits for bots and ignored
    if(shouldSkipCommit(commit, config)){
        return;
    }
    commit.message.split(EOL).forEach(line => {
        let match = line.match(SIGN_OFF_TRAILER_REGEX);
        if (match !== null) {
            let signed = { name: match[1], email: `${match[2]}@${match[3]}` };
            if ((signed.name === commit.author.name && signed.email === commit.author.email) // signed by author
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
