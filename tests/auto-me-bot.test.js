const sinon = require('sinon');
const chai = require('chai');
const rewire = require('rewire');
const beforeEach = require('mocha').beforeEach;

chai.use(require('sinon-chai'));

const autoMeBot = rewire('../src/auto-me-bot');

const expect = chai.expect;

suite('Testing the auto-me-bot export', () => {
    let probotFake;
    let probotOnFunctionFake;
    let conventionalCommitsHandlerSpy;
    let tasksListHandlerSpy;

    beforeEach(() => {
        sinon.restore(); // unwrap any previous wrapped sinon objects
        probotFake = sinon.fake(); // create a fake probot for starting the app
        probotOnFunctionFake = sinon.fake(); // create a fake "on" function for the probot
        probotFake.on = probotOnFunctionFake; // bind the fake "on" function to the fake probot

        // inject a spy for the conventional commits handler
        conventionalCommitsHandlerSpy = sinon.spy(autoMeBot.__get__('enforceConventionalCommits'));
        autoMeBot.__set__('enforceConventionalCommits', conventionalCommitsHandlerSpy);

        // inject a spy for the tasks list handler
        tasksListHandlerSpy = sinon.spy(autoMeBot.__get__('enforceTasksList'));
        autoMeBot.__set__('enforceTasksList', tasksListHandlerSpy);
    });

    test('When invoking the application, expect a registration of the application triggers', () => {
        // when invoking the application with fake probot
        autoMeBot(probotFake);
        // then expect the on fake method to be called with an array of triggers and handling function
        expect(probotOnFunctionFake).to.be.calledOnceWith(sinon.match.array, sinon.match.func);
    });
});
