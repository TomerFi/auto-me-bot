'use strict';

const yaml = require('js-yaml');

const prConventionalCommitsHandler = require('./handlers/pr-conventional-commits');
const prSignedCommitsHandler = require('./handlers/pr-signed-commits');
const prTasksListHandler = require('./handlers/pr-tasks-list');

module.exports = autoMeBot;

/* ######################################## ##
## #### Pull request related constants #### ##
## ######################################## */
const TRIGGERING_EVENTS = [
    'pull_request.opened',
    'pull_request.edited',
    'pull_request.synchronize'
];

// handlers should take context, config, and iso startedAt
const CONFIGURATION_MAP = {
    pr: {
        conventionalCommits: {
            event: 'pull_request',
            actions: ['opened', 'edited', 'synchronize'],
            run: () => prConventionalCommitsHandler,
        },
        signedCommits: {
            event: 'pull_request',
            actions: ['opened', 'edited', 'synchronize'],
            run: () => prSignedCommitsHandler,
        },
        tasksList: {
            event: 'pull_request',
            actions: ['opened', 'edited', 'synchronize'],
            run: () => prTasksListHandler,
        },
    }
};

/* ########################### ##
## #### Utility functions #### ##
## ########################### */
function infoLogger(message) {
    if (process.env.REPORT_MODE === 'on') {
        return;
    }
    console.log(message)
}

/* ################################################### ##
## #### Main exported function registering events #### ##
## ################################################### */
function autoMeBot(probot) {
    probot.on(TRIGGERING_EVENTS, handlersController(CONFIGURATION_MAP));
}

/* ################################################################ ##
## #### Distributes handler invocations based on configuration #### ##
## ################################################################ */
function handlersController(configSpec) {
    return async context => {
        // get config from current repo .github folder or from the .github repo's .github folder
        let config = await context.config('auto-me-bot.yml');
        infoLogger('CONTEXT\n' + JSON.stringify(context, null, 2));
        infoLogger('CONFIG\n' + yaml.dump(config));
        let invocations = []
        let startedAt = new Date().toISOString();
        for (let configType in config) {
            let currentConfig = config[configType];
            let currentConfigSpec = configSpec[configType];
            for (let handlerType in currentConfig) {
                if (handlerType in currentConfigSpec) {
                    let currentHandlerConfig = currentConfig[handlerType]; // nullable
                    let currentHandlerSpec = currentConfigSpec[handlerType];
                    if (currentHandlerSpec.event in context.payload) {
                        if (currentHandlerSpec.actions.includes(context.payload[currentHandlerSpec.event].action)) {
                            invocations.push(currentHandlerSpec.run()(context, currentHandlerConfig, startedAt));
                        }
                    }

                }
            }
        }
        if (invocations) {
            await Promise.allSettled(invocations);
        }
    }
}
