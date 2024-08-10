import chai, { expect } from 'chai'
import sinonChai from 'sinon-chai'
import sinon from 'sinon'
import { beforeEach } from 'mocha'

chai.use(sinonChai)

import { handlersController as app } from '../src/auto-me-bot.js'

import autoApproveHandlerOrig from '../src/handlers/pr-auto-approve.js'
import convCommitsHandlerOrig from  '../src/handlers/pr-conventional-commits.js'
import convTitleHandlerOrig from  '../src/handlers/pr-conventional-title.js'
import lifecycleLabelsHandlerOrig from  '../src/handlers/pr-lifecycle-labels.js'
import signedCommitsHandlerOrig from  '../src/handlers/pr-signed-commits.js'
import tasksListHandlerOrig from  '../src/handlers/pr-tasks-list.js'

suite('Testing the auto-me-bot export', () => {
    // turn off logs
    console.info = function() { /**/ };

    suite('Test various pull request related configurations', () => {
        let autoApproveHandlerStub;
        let conventionalCommitsHandlerStub;
        let conventionalTitleHandlerStub;
        let lifecycleLabelsHandlerStub;
        let signedCommitsHandlerStub;
        let tasksListHandlerStub;
        let configFuncStub;

        let fakeContext;

        let prHandlersControllerSut;

        let allHandlers;
        let patchedConfigSpec;

        beforeEach(() => {
            // patch the autoApprove handler's run function to a stub
            autoApproveHandlerStub = sinon.stub();
            let autoApproveApproveHandlerPatch = {
                match: autoApproveHandlerOrig.match,
                run: autoApproveHandlerStub
            }
            // patch the conventionalCommits handler's run function to a stub
            conventionalCommitsHandlerStub = sinon.stub();
            let conventionalCommitsHandlerPatch = {
                match: convCommitsHandlerOrig.match,
                run: conventionalCommitsHandlerStub
            };
            // patch the conventionalTitle handler's run function to a stub
            conventionalTitleHandlerStub = sinon.stub();
            let conventionalTitleHandlerPatch = {
                match: convTitleHandlerOrig.match,
                run: conventionalTitleHandlerStub
            };
            // patch the lifecycle handler's run function to a stub
            lifecycleLabelsHandlerStub = sinon.stub();
            let lifecycleLabelHandlerPatch = {
                match: lifecycleLabelsHandlerOrig.match,
                run: lifecycleLabelsHandlerStub
            };
            // patch the signedCommits handler's run function to a stub
            signedCommitsHandlerStub = sinon.stub();
            let signedCommitsHandlerPatch = {
                match: signedCommitsHandlerOrig.match,
                run: signedCommitsHandlerStub
            }
            // patch the tasksList handler's run function to a stub
            tasksListHandlerStub = sinon.stub();
            let tasksListHandlerPatch = {
                match: tasksListHandlerOrig.match,
                run: tasksListHandlerStub
            };
            // all handlers should be listed here for testing purposes
            allHandlers = [
                conventionalCommitsHandlerStub,
                conventionalTitleHandlerStub,
                lifecycleLabelsHandlerStub,
                signedCommitsHandlerStub,
                tasksListHandlerStub,
            ];
            // create a patched config spec for injecting the patched handlers into the application
            patchedConfigSpec = {
                pr: {
                    autoApprove: autoApproveApproveHandlerPatch,
                    conventionalCommits: conventionalCommitsHandlerPatch,
                    conventionalTitle: conventionalTitleHandlerPatch,
                    lifecycleLabels: lifecycleLabelHandlerPatch,
                    signedCommits: signedCommitsHandlerPatch,
                    tasksList: tasksListHandlerPatch,
                }
            };
            // grab the handlersController configured for pr related operations using the patched configuration
            prHandlersControllerSut = app(patchedConfigSpec)
            // create a fake context for invoking the application with and stub the config method
            configFuncStub = sinon.stub();
            fakeContext = {
                payload: {
                    pull_request: {},
                    action: 'opened'
                },
                config: configFuncStub
            };

        });

        test('When all PR operations are checked, execute all PR related handlers', async () => {
            // create a flag-only config for all handlers, i.e. {pr: {conventionalTitle: {}, tasksList: {} ... }}
            let flagOnlyConfig = {pr: {...patchedConfigSpec.pr}}
            Object.keys(flagOnlyConfig.pr).forEach(k => flagOnlyConfig.pr[k] = {});
            // given the config stub will return the flag only config
            configFuncStub.withArgs('auto-me-bot.yml').resolves(flagOnlyConfig);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect all pr related handlers to be invoked
            allHandlers.forEach(handler => expect(handler).to.have.been.calledOnceWith(
                fakeContext, {}, sinon.match(t => Date.parse(t))));
        });

        test('When the autoApprove operation is checked, execute the related handler', async () => {
            // given the following pr configuration
            let fullConfig = {pr: { autoApprove:{} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(fullConfig);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect only the related handler to be invoked
            allHandlers
                .filter(handler => handler !== autoApproveHandlerStub)
                .forEach(handler => expect(handler).to.have.not.been.called);
            expect(autoApproveHandlerStub).to.have.been.calledOnceWith(
                fakeContext, fullConfig.pr.autoApprove, sinon.match(t => Date.parse(t)));
        });

        test('When the conventionalCommits operation is checked, execute the related handler', async () => {
            // given the following pr configuration
            let fullConfig = {pr: { conventionalCommits:{} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(fullConfig);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect only the related handler to be invoked
            allHandlers
                .filter(handler => handler !== conventionalCommitsHandlerStub)
                .forEach(handler => expect(handler).to.have.not.been.called);
            expect(conventionalCommitsHandlerStub).to.have.been.calledOnceWith(
                fakeContext, fullConfig.pr.conventionalCommits, sinon.match(t => Date.parse(t)));
        });

        test('When the conventionalTitle operation is checked, execute the related handler', async () => {
            // given the following pr configuration
            let fullConfig = {pr: { conventionalTitle:{} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(fullConfig);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect only the related handler to be invoked
            allHandlers
                .filter(handler => handler !== conventionalTitleHandlerStub)
                .forEach(handler => expect(handler).to.have.not.been.called);
            expect(conventionalTitleHandlerStub).to.have.been.calledOnceWith(
                fakeContext, fullConfig.pr.conventionalTitle, sinon.match(t => Date.parse(t)));
        });

        test('When the lifecycleLabels operation is checked, execute the related handler', async () => {
            // given the following pr configuration
            let fullConfig = {pr: { lifecycleLabels: {} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(fullConfig);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect only the related handler to be invoked
            allHandlers
                .filter(handler => handler !== lifecycleLabelsHandlerStub)
                .forEach(handler => expect(handler).to.have.not.been.called);
            expect(lifecycleLabelsHandlerStub).to.have.been.calledOnceWith(
                fakeContext, fullConfig.pr.lifecycleLabels, sinon.match(t => Date.parse(t)));
        });

        test('When the signedCommits operation is checked, execute the related handler', async () => {
            // given the following pr configuration
            let config = {pr: { signedCommits:{} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(config);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect only the related handler to be invoked
            allHandlers
                .filter(handler => handler !== signedCommitsHandlerStub)
                .forEach(handler => expect(handler).to.have.not.been.called);
            expect(signedCommitsHandlerStub).to.have.been.calledOnceWith(
                fakeContext, config.pr.signedCommits, sinon.match(t => Date.parse(t)));
        });

        test('When the tasksList operation is checked, execute the related handler', async () => {
            // given the following pr configuration
            let config = {pr: { tasksList:{} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(config);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect only the related handler to be invoked
            allHandlers
                .filter(handler => handler !== tasksListHandlerStub)
                .forEach(handler => expect(handler).to.have.not.been.called);
            expect(tasksListHandlerStub).to.have.been.calledOnceWith(
                fakeContext, config.pr.tasksList, sinon.match(t => Date.parse(t)))
        });

        [ { pr: {}}, {}, null, { pr: { unknownHandler: {}}}].forEach(config => {
            test(`When no operations are checked and config is ${JSON.stringify(config)}, do not execute any handlers`, async () => {
                // given the current pr configuration
                configFuncStub.withArgs('auto-me-bot.yml').resolves(config);
                // when invoking the controller
                await prHandlersControllerSut(fakeContext);
                // then expect no handlers to be invoked
                allHandlers.forEach(handler => expect(handler).to.have.not.been.called);
            });
        });

        test('When event payload contains an unsupported event type, do not execute any handlers', async () => {
            // given the current pr configuration
            let config = {pr: { conventionalCommits:{}, signedCommits: {}, tasksList: {} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(config);
            // when invoking the controller with a patched context
            let patchedContext = {
                payload: {
                    unknown_event_type: {},
                    action: 'opened'
                },
                config: configFuncStub
            };
            await prHandlersControllerSut(patchedContext);
            // then expect no handlers to be invoked
            allHandlers.forEach(handler => expect(handler).to.have.not.been.called);
        });

        test('When event payload event action type is not supported, do not execute any handlers', async () => {
            // given the current pr configuration
            let config = {pr: { conventionalCommits:{}, signedCommits: {}, tasksList: {} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(config);
            // when invoking the controller with a patched context
            let patchedContext = {
                payload: {
                    pull_request: {},
                    action: 'closed_shades'
                },
                config: configFuncStub
            };
            await prHandlersControllerSut(patchedContext);
            // then expect no handlers to be invoked
            allHandlers.forEach(handler => expect(handler).to.have.not.been.called);
        });
    });
});
