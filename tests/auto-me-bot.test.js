const chai = require('chai');
const rewire = require('rewire');
const sinon = require('sinon');
const { beforeEach } = require('mocha');

chai.use(require('sinon-chai'));

const autoMeBot = rewire('../src/auto-me-bot');
const expect = chai.expect;

suite('Testing the auto-me-bot export', () => {
    // turn off logs
    console.info = function() { /**/ };

    test('When invoking the application, expect a registration of the events', () => {
        let probotFake = sinon.fake(); // create a fake probot for starting the app
        let probotOnFunctionFake = sinon.fake(); // create a fake "on" function for the probot
        // given the fake probot will adhere the fake 'on' function
        probotFake.on = probotOnFunctionFake;
        // when invoking the application with the fake probot
        autoMeBot(probotFake);
        // then expect the 'on' fake method to be called with the pull request events list
        expect(probotOnFunctionFake).to.be.calledOnceWith(
            autoMeBot.__get__('ON_EVENTS'),
            sinon.match.func
        );
    });

    suite('Test various pull request related configurations', () => {
        let conventionalCommitsHandlerStub;
        let lifecycleLabelsHandlerStub;
        let signedCommitsHandlerStub;
        let tasksListHandlerStub;
        let configFuncStub;

        let fakeContext;

        let prHandlersControllerSut;

        beforeEach(() => {
            // patch the conventionalCommits handler's run function to a stub
            conventionalCommitsHandlerStub = sinon.stub();
            let conventionalCommitsHandlerPatch = {
                match: require('../src/handlers/pr-conventional-commits').match,
                run: conventionalCommitsHandlerStub
            };
            // patch the lifecycle handler's run function to a stub
            lifecycleLabelsHandlerStub = sinon.stub();
            let lifecycleLabelHandlerPatch = {
                match: require('../src/handlers/pr-lifecycle-labels').match,
                run: lifecycleLabelsHandlerStub
            };
            // patch the signedCommits handler's run function to a stub
            signedCommitsHandlerStub = sinon.stub();
            let signedCommitsHandlerPatch = {
                match: require('../src/handlers/pr-signed-commits').match,
                run: signedCommitsHandlerStub
            }
            // patch the tasksList handler's run function to a stub
            tasksListHandlerStub = sinon.stub();
            let tasksListHandlerPatch = {
                match: require('../src/handlers/pr-tasks-list').match,
                run: tasksListHandlerStub
            };
            // create a patched config spec for injecting the patched handlers into the application
            let patchedConfigSpec = {
                pr: {
                    conventionalCommits: conventionalCommitsHandlerPatch,
                    lifecycleLabels: lifecycleLabelHandlerPatch,
                    signedCommits: signedCommitsHandlerPatch,
                    tasksList: tasksListHandlerPatch,
                }
            };
            // grab the handlersController configured for pr related operations using the patched configuration
            prHandlersControllerSut = autoMeBot.__get__('handlersController')(patchedConfigSpec)
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
            // given the following pr full configuration
            let fullConfig = {pr: { conventionalCommits:{}, lifecycleLabels: {}, signedCommits: {}, tasksList: {} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(fullConfig);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect all pr related handlers to be invoked
            expect(conventionalCommitsHandlerStub).to.have.been.calledOnceWith(
                fakeContext, fullConfig.pr.conventionalCommits, sinon.match(t => Date.parse(t)));
            expect(lifecycleLabelsHandlerStub).to.have.been.calledOnceWith(
                fakeContext, fullConfig.pr.lifecycleLabels, sinon.match(t => Date.parse(t)));
            expect(signedCommitsHandlerStub).to.have.been.calledOnceWith(
                fakeContext, fullConfig.pr.signedCommits, sinon.match(t => Date.parse(t)));
            expect(tasksListHandlerStub).to.have.been.calledOnceWith(
                fakeContext, fullConfig.pr.tasksList, sinon.match(t => Date.parse(t)));
        });

        test('When the conventionalCommits operation is checked, execute the related handler', async () => {
            // given the following pr configuration
            let fullConfig = {pr: { conventionalCommits:{} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(fullConfig);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect only the related handler to be invoked
            expect(conventionalCommitsHandlerStub).to.have.been.calledOnceWith(
                fakeContext, fullConfig.pr.conventionalCommits, sinon.match(t => Date.parse(t)));
            expect(lifecycleLabelsHandlerStub).to.have.not.been.called;
            expect(signedCommitsHandlerStub).to.have.not.been.called;
            expect(tasksListHandlerStub).to.have.not.been.called;
        });

        test('When the lifecycleLabels operation is checked, execute the related handler', async () => {
            // given the following pr configuration
            let fullConfig = {pr: { lifecycleLabels: {} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(fullConfig);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect only the related handler to be invoked
            expect(conventionalCommitsHandlerStub).to.have.not.been.called;
            expect(lifecycleLabelsHandlerStub).to.have.been.calledOnceWith(
                fakeContext, fullConfig.pr.lifecycleLabels, sinon.match(t => Date.parse(t)));
            expect(signedCommitsHandlerStub).to.have.not.been.called;
            expect(tasksListHandlerStub).to.have.not.been.called;
        });

        test('When the signedCommits operation is checked, execute the related handler', async () => {
            // given the following pr configuration
            let config = {pr: { signedCommits:{} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(config);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect only the related handler to be invoked
            expect(conventionalCommitsHandlerStub).to.have.not.been.called;
            expect(lifecycleLabelsHandlerStub).to.have.not.been.called;
            expect(signedCommitsHandlerStub).to.have.been.calledOnceWith(
                fakeContext, config.pr.signedCommits, sinon.match(t => Date.parse(t)));
            expect(tasksListHandlerStub).to.have.not.been.called;
        });

        test('When the tasksList operation is checked, execute the related handler', async () => {
            // given the following pr configuration
            let config = {pr: { tasksList:{} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(config);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect only the related handler to be invoked
            expect(conventionalCommitsHandlerStub).to.have.not.been.called;
            expect(lifecycleLabelsHandlerStub).to.have.not.been.called;
            expect(signedCommitsHandlerStub).to.have.not.been.called;
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
                expect(conventionalCommitsHandlerStub).to.have.not.been.called;
                expect(lifecycleLabelsHandlerStub).to.have.not.been.called;
                expect(signedCommitsHandlerStub).to.have.not.been.called;
                expect(tasksListHandlerStub).to.have.not.been.called;
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
            expect(conventionalCommitsHandlerStub).to.have.not.been.called;
            expect(lifecycleLabelsHandlerStub).to.have.not.been.called;
            expect(signedCommitsHandlerStub).to.have.not.been.called;
            expect(tasksListHandlerStub).to.have.not.been.called;
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
            expect(conventionalCommitsHandlerStub).to.have.not.been.called;
            expect(lifecycleLabelsHandlerStub).to.have.not.been.called;
            expect(signedCommitsHandlerStub).to.have.not.been.called;
            expect(tasksListHandlerStub).to.have.not.been.called;
        });
    });
});
