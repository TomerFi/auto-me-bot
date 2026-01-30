# Skill: Add New Handler to Auto-Me-Bot

This skill guides you through creating a new handler for auto-me-bot.

## Prerequisites
- Understand the handler contract (match + run functions)
- Know which GitHub webhook event(s) the handler should respond to
- Have a clear definition of what the handler should check/enforce

## Steps

### 1. Create Handler File
- Location: `src/handlers/<config-type>-<handler-name>.js`
- For PR handlers: `src/handlers/pr-<handler-name>.js`

### 2. Implement match() Function
```javascript
module.exports.match = function(context) {
    let event = 'pull_request';
    let actions = ['opened', 'edited']; // Adjust based on handler needs
    return event in context.payload ? actions.includes(context.payload.action) : false;
}
```

### 3. Implement run() Function
```javascript
const CHECK_NAME = 'Handler Name';
const BOT_CHECK_URL = 'https://auto-me-bot.figenblat.com/handlers/handler-name';

module.exports.run = async function(context, config, startedAt) {
    // Create check-run
    let checkRun = await context.octokit.checks.create(context.repo({
        head_sha: context.payload.pull_request.head.sha,
        name: CHECK_NAME,
        details_url: BOT_CHECK_URL,
        started_at: startedAt,
        status: 'in_progress'
    }));

    try {
        // Handler logic here
        let success = true; // Replace with actual logic

        // Update check-run with result
        await context.octokit.checks.update(context.repo({
            check_run_id: checkRun.data.id,
            name: CHECK_NAME,
            details_url: BOT_CHECK_URL,
            started_at: startedAt,
            status: 'completed',
            completed_at: new Date().toISOString(),
            conclusion: success ? 'success' : 'failure',
            output: {
                title: success ? 'Success message' : 'Failure message',
                summary: 'Detailed explanation'
            }
        }));
    } catch (error) {
        // Handle errors gracefully
        await context.octokit.checks.update(context.repo({
            check_run_id: checkRun.data.id,
            status: 'completed',
            conclusion: 'failure',
            output: {
                title: 'Error occurred',
                summary: error.message
            }
        }));
    }
}
```

### 4. Create Test File
- Location: `tests/handlers/<config-type>-<handler-name>.test.js`
- Test both match() and run() functions
- Use Sinon to stub context.octokit methods
- Achieve full coverage

### 5. Register Handler
Edit `src/auto-me-bot.js`:
```javascript
// Import handler
import handlerName from './handlers/pr-handler-name.js'

// Add to CONFIG_SPEC
const CONFIG_SPEC = Object.freeze({
    pr: {
        // ... existing handlers
        handlerName: handlerName,
    }
});

// Add required events to ON_EVENTS if needed
const ON_EVENTS = Object.freeze([
    // ... existing events
    'pull_request.opened', // Example
]);
```

### 6. Update Test Registration
Edit `tests/auto-me-bot.test.js`:
- Create stub in beforeEach
- Add stub to allHandlers list
- Add patch to patchedConfigSpec

### 7. Create Documentation
- Create `docs/handlers/handler-name.md`
- Update `mkdocs.yml` navigation
- Update `docs/config.md`
- Add example to `docs/examples.md`

### 8. Test Everything
```bash
npm run lint
npm test
mkdocs serve
```

## Verification
- [ ] Handler file created with match() and run()
- [ ] Test file created with full coverage
- [ ] Handler registered in CONFIG_SPEC
- [ ] Events added to ON_EVENTS
- [ ] Test registration updated
- [ ] Documentation created
- [ ] All tests pass
- [ ] Linting passes
