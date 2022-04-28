const beforeEach = require('mocha').beforeEach;
const chai = require('chai');
const rewire = require('rewire');
const sinon = require('sinon');

chai.use(require('sinon-chai'));

const autoMeBot = rewire('../src/auto-me-bot');
const expect = chai.expect;

suite('Testing the auto-me-bot export', () => {
    test('When invoking the application, expect a registration of the events', () => {
        let probotFake = sinon.fake(); // create a fake probot for starting the app
        let probotOnFunctionFake = sinon.fake(); // create a fake "on" function for the probot
        // given the fake probot will adhere the fake 'on' function
        probotFake.on = probotOnFunctionFake;
        // when invoking the application with the fake probot
        autoMeBot(probotFake);
        // then expect the 'on' fake method to be called with the pull request events list
        expect(probotOnFunctionFake).to.be.calledOnceWith(
            autoMeBot.__get__('PR_EVENTS'),
            sinon.match.func
        );
    });

    suite('Test various pull request related configurations', () => {
        let conventionalCommitsHandlerStub;
        let signedCommitsHandlerStub
        let tasksListHandlerStub;
        let configFuncStub;

        let fakeContext = {};

        let prHandlersControllerSut;

        beforeEach(() => {
            // create stubs
            conventionalCommitsHandlerStub = sinon.stub();
            signedCommitsHandlerStub = sinon.stub();
            tasksListHandlerStub = sinon.stub();
            configFuncStub = sinon.stub();
            // create a fake context for invoking the application with
            fakeContext = {
                payload: {
                    pull_request: {}
                },
                config: configFuncStub
            };
            // inject handlers stubs
            autoMeBot.__set__({
                prConventionalCommitsHandler: conventionalCommitsHandlerStub,
                prSignedCommitsHandler: signedCommitsHandlerStub,
                prTasksListHandler: tasksListHandlerStub
            });
            // grab the handlersController configured for pr related operations
            prHandlersControllerSut = autoMeBot.__get__('handlersController')(
                autoMeBot.__get__('PR_PREDICATE'),
                autoMeBot.__get__('PR_HANDLERS')
            );
        })

        test('When all PR operations are checked, execute all PR related handlers', async () => {
            // given the following pr full configuration
            let fullConfig = {pr: { conventionalCommits:{}, signedCommits: {}, tasksList: {} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(fullConfig);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect all pr related handlers to be invoked
            return Promise.all([
                expect(conventionalCommitsHandlerStub).to.have.been.calledOnceWith(
                    fakeContext, fullConfig, sinon.match(t => Date.parse(t))),
                expect(signedCommitsHandlerStub).to.have.been.calledOnceWith(
                    fakeContext, fullConfig, sinon.match(t => Date.parse(t))),
                expect(tasksListHandlerStub).to.have.been.calledOnceWith(
                    fakeContext, fullConfig, sinon.match(t => Date.parse(t))),
            ]);
        });

        test('When the conventionalCommits operation is checked, execute the related handler', async () => {
            // given the following pr configuration
            let fullConfig = {pr: { conventionalCommits:{} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(fullConfig);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect only the related handler to be invoked
            return Promise.all([
                expect(conventionalCommitsHandlerStub).to.have.been.calledOnceWith(
                    fakeContext, fullConfig, sinon.match(t => Date.parse(t))),
                expect(signedCommitsHandlerStub).to.have.not.been.called,
                expect(tasksListHandlerStub).to.have.not.been.called,
            ]);
        });

        test('When the signedCommits operation is checked, execute the related handler', async () => {
            // given the following pr configuration
            let config = {pr: { signedCommits:{} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(config);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect only the related handler to be invoked
            return Promise.all([
                expect(conventionalCommitsHandlerStub).to.have.not.been.called,
                expect(signedCommitsHandlerStub).to.have.been.calledOnceWith(
                    fakeContext, config, sinon.match(t => Date.parse(t))),
                expect(tasksListHandlerStub).to.have.not.been.called,
            ]);
        });

        test('When the tasksList operation is checked, execute the related handler', async () => {
            // given the following pr configuration
            let config = {pr: { tasksList:{} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(config);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect only the related handler to be invoked
            return Promise.all([
                expect(conventionalCommitsHandlerStub).to.have.not.been.called,
                expect(signedCommitsHandlerStub).to.have.not.been.called,
                expect(tasksListHandlerStub).to.have.been.calledOnceWith(
                    fakeContext, config, sinon.match(t => Date.parse(t))),
            ]);
        });

        [ { pr: {}}, {}, null].forEach(config => {
            test(`When no operations is checked and config is ${JSON.stringify(config)}, do not execute any handlers`, async () => {
                // given the current pr configuration
                configFuncStub.withArgs('auto-me-bot.yml').resolves(config);
                // when invoking the controller
                await prHandlersControllerSut(fakeContext);
                // then expect only the related handler to be invoked
                return Promise.all([
                    expect(conventionalCommitsHandlerStub).to.have.not.been.called,
                    expect(signedCommitsHandlerStub).to.have.not.been.called,
                    expect(tasksListHandlerStub).to.have.not.been.called,
                ]);
            });
        });
    });
});
