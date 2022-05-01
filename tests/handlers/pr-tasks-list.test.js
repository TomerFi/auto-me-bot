const beforeEach = require('mocha').beforeEach;
const chai = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

chai.use(require('sinon-chai'));

const prTasksListHandler = rewire('../../src/handlers/pr-tasks-list');
const expect = chai.expect;

const EOL = require('os').EOL;

suite('Testing the pr-tasks-list handler', () => {
    /* ######################### ##
    ## #### Shared Fixtures #### ##
    ## ######################### */
    const fakeSha = '#f54dda543@';
    const fakeCheckId = 13;

    // the expected arg for creating a new check run
    const expectedCreateCheckRunInfo = {
        head_sha: fakeSha,
        name: sinon.match.string,
        details_url: sinon.match(u => new URL(u)),
        started_at: sinon.match(t => Date.parse(t)),
        status: 'in_progress'
    };
    // the stubbed response for creating a new check run
    const createCheckResponse = {
        data: {
            id: fakeCheckId
        }
    };

    /* ######################################################## ##
    ## #### Fixtures for testing a full checked tasks list #### ##
    ## ######################################################## */
    const checkedBody = [
        '- [x] task 1',
        '- [x] task 2',
        '- [x] task 3'
    ].join(EOL);

    const checkedConclusion = 'success';

    const checkedOutput = {
        title: 'Well Done!',
        summary: 'You made it through',
        text: [
            '### Here\'s a list of your accomplishments',
            '- task 1',
            '- task 2',
            '- task 3'
        ].join(EOL)
    };

    /* ###################################################### ##
    ## #### Fixtures for testing an unchecked tasks list #### ##
    ## ###################################################### */
    const uncheckedBody = [
        '- [x] task 1',
        '- [ ] task 2',
        '- [ ] task 3'
    ].join(EOL);

    const uncheckedConclusion = 'failure';

    const uncheckedOutput = {
        title: 'Found 2 unchecked tasks',
        summary: 'I\'m sure you know what do with these',
        text: [
            '### The following tasks needs to be completed',
            '- task 2',
            '- task 3'
        ].join(EOL)
    };

    /* ############################################### ##
    ## #### Fixtures for testing a non-tasks list #### ##
    ## ############################################### */
    const noTasksBody = [
        '- [] task 1',
        '- task 2',
        '- ( ) task 3'
    ].join(EOL);

    const noTasksConclusion = 'success';

    const noTasksOutput = {
        title: 'No tasks lists found',
        summary: 'Nothing for me to do here'
    };

    /* ############################ ##
    ## #### Dynamic Test Cases #### ##
    ## ############################ */
    let testCases = [
        {
            testTitle: 'Test with all tasks checked, expect the check to pass with a summary of the completed tasks',
            prBody: checkedBody,
            expectConclusion: checkedConclusion,
            expectedOutput: checkedOutput
        },
        {
            testTitle: 'Test with unchecked tasks, expect the check to fail with a report of the not yet completed tasks',
            prBody: uncheckedBody,
            expectConclusion: uncheckedConclusion,
            expectedOutput: uncheckedOutput
        },
        {
            testTitle: 'Test with not tasks, expect the check to fail providing notification indicating no tasks found',
            prBody: noTasksBody,
            expectConclusion: noTasksConclusion,
            expectedOutput: noTasksOutput
        }
    ];

    /* ######################### ##
    ## #### Stubs and Fakes #### ##
    ## ######################### */
    let createCheckStub;
    let repoFuncStub;
    let updateCheckStub;

    let fakeContext = {};
    let expectedUpdateCheck = {};

    beforeEach(() => {
        // unwrap any previous wrapped sinon objects
        sinon.restore();
        // create stubs for the context functions
        createCheckStub = sinon.stub();
        repoFuncStub = sinon.stub();
        updateCheckStub = sinon.stub();
        // expected update check run argument
        expectedUpdateCheck = {
            check_run_id: fakeCheckId,
            name: sinon.match.string,
            details_url: sinon.match(u => new URL(u)),
            started_at: sinon.match(t => Date.parse(t)),
            status: 'completed',
            completed_at: sinon.match(t => Date.parse(t)),
        }
        // create a fake context for invoking the application with
        fakeContext = {
            payload: {
                pull_request: {
                    head: {
                        sha: fakeSha
                    }
                }
            },
            octokit: {
                checks: {
                    create: createCheckStub,
                    update: updateCheckStub
                },
            },
            repo: repoFuncStub
        };
    });

    testCases.forEach(testCase => {
        test(testCase.testTitle, async () => {
            // given the context will be stubbed with the sut pr body
            fakeContext.payload.pull_request.body = testCase.prBody;
            // given the expected update will be stubbed with info from the current sut
            expectedUpdateCheck.conclusion = testCase.expectConclusion;
            expectedUpdateCheck.output = testCase.expectedOutput;
            // given the repo function will loop back the first argument it gets
            repoFuncStub.returnsArg(0);
            // given the create check function will resolve to the fake response
            createCheckStub.resolves(createCheckResponse);

            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await prTasksListHandler(fakeContext, sinon.fake(), new Date().toISOString());

            // then expect the following functions invocation flow
            expect(repoFuncStub).to.have.calledWith(expectedCreateCheckRunInfo);
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);

            expect(repoFuncStub).to.have.calledWith(expectedUpdateCheck);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
        });
    })
});
