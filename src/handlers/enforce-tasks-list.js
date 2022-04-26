const marked = require('marked');

const CHECK_NAME = 'Auto-Me-Bot Tasks List';
const BOT_CHECK_URL = 'https://auto-me-bot.tomfi.info';

module.exports = enforceTasksList;

/*
# example auto-me-bot.yml configuration
pr:
    tasksList:
*/

// Handler for verifying PR tasks' list is completed
async function enforceTasksList(context, _config, startedAt) {
    // create the initial check run and mark it as in_progress
    let checkRun = await context.octokit.checks.create(context.repo({
        head_sha: context.payload.pull_request.head.sha,
        name: CHECK_NAME,
        details_url: BOT_CHECK_URL,
        started_at: startedAt,
        status: 'in_progress'
    }));

    var checkedTasks = [];
    var uncheckedTasks = [];

    new marked.Lexer({gfm: true})
        .blockTokens(context.payload.pull_request.body)
        .filter(token => token.type === 'list')
        .flatMap(list => list.items)
        .filter(item => item.task)
        .forEach(item => item.checked ? checkedTasks.push(item) : uncheckedTasks.push(item));

    // default output for no tasks found
    let numChecked = checkedTasks.length;
    let numUnchecked = uncheckedTasks.length;
    let finalConclusion = 'success';
    let outputReport = {
        title: 'Nothing for me to do here',
        summary: 'I can\'t find any tasks\'s list to enforce'
    };

    // if found tasks
    if (numUnchecked > 0) {
        // found unchecked tasks
        finalConclusion = 'failure';
        outputReport = {
            title: `Found ${numUnchecked} unchecked tasks`,
            summary: 'I\'m sure you know what do with these.',
            text: parseTasks(uncheckedTasks, 'The following tasks needs to be completed')
        }
    } else if (numChecked > 0) {
        // found checks tasks with no unchecked tasks
        outputReport = {
            title: 'Well Done!',
            summary: 'You made it through',
            text: parseTasks(checkedTasks, 'Here\'s a list of your accomplishments')
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

// create markdown list of tasks
function parseTasks(tasks, header) {
    let tasksLines = [`### ${header}`];
    tasks.map(task => task.text).forEach(text => tasksLines.push(`- ${text}`));
    // return tasks as string
    return tasksLines.join('\r\n');

}
