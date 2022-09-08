const marked = require('marked');
const { EOL } = require('os');

const BOT_CHECK_URL = 'https://auto-me-bot.tomfi.info';
const CHECK_NAME = 'Auto-Me-Bot Tasks List';

// matcher for picking up events
module.exports.match = function(context) {
    let event = 'pull_request';
    let actions = ['opened', 'edited', 'synchronize'];

    if (event in context.payload) {
        return actions.includes(context.payload.action);
    }

    return false;
}

// handler for verifying PR tasks' list is completed
module.exports.run = async function(context, _config, startedAt) {
    // create the initial check run and mark it as in_progress
    let checkRun = await context.octokit.checks.create(context.repo({
        head_sha: context.payload.pull_request.head.sha,
        name: CHECK_NAME,
        details_url: BOT_CHECK_URL,
        started_at: startedAt,
        status: 'in_progress'
    }));
    // get all the task list token and split them into checked and unchecked
    let checkedTasks = [];
    let uncheckedTasks = [];
    new marked.Lexer({gfm: true})
        .blockTokens(context.payload.pull_request.body)
        .filter(token => token.type === 'list')
        .flatMap(list => list.items)
        .filter(item => item.task)
        .forEach(item => item.checked ? checkedTasks.push(item) : uncheckedTasks.push(item));

    let numChecked = checkedTasks.length;
    let numUnchecked = uncheckedTasks.length;

    // default output for no tasks found
    let report = {
        conclusion: 'success',
        output: {
            title: 'No tasks lists found',
            summary: 'Nothing for me to do here'
        }
    };
    // if found tasks
    if (numUnchecked > 0) {
        // found unchecked tasks
        report.conclusion = 'failure';
        report.output.title = `Found ${numUnchecked} unchecked tasks`;
        report.output.summary = 'I\'m sure you know what do with these';
        report.output.text = parseTasks(uncheckedTasks, 'The following tasks needs to be completed');
    } else if (numChecked > 0) {
        // found checked tasks with no unchecked tasks
        report.output.title = 'All Done!';
        report.output.summary = 'You made it through';
        report.output.text = parseTasks(checkedTasks, 'Here\'s a list of your accomplishments');
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

// create markdown list of tasks
function parseTasks(tasks, header) {
    let tasksLines = [`### ${header}`];
    tasks.map(task => task.text).forEach(text => tasksLines.push(`- ${text}`));
    // return tasks as string
    return tasksLines.join(EOL);
}
