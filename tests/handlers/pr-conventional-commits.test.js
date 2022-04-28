const beforeEach = require('mocha').beforeEach;
const chai = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

chai.use(require('sinon-chai'));

const prConventionalCommitsHandler = rewire('../../src/handlers/pr-conventional-commits');
const expect = chai.expect;

const EOL = require('os').EOL;
const STUB_COMMITLINT = true; // set this to false to invoke the actual commitlint tool instead of stubbing it

suite('Testing the pr-conventional-commits handler', () => {
    /* ######################### ##
    ## #### Shared Fixtures #### ##
    ## ######################### */
    const fakeSha = '#f54dda543@';
    const fakeCheckId = 13;
    const fakePRNumber = 66;
    const fakeCommitUrl = `https://fake.commit.url/${fakeSha}`;

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
    // the expected arg for listing all the commits in the PR
    const expectedListCommitsInfo = {
        pull_number: fakePRNumber
    };

    /* ######################################################### ##
    ## #### Fixtures for 1 success commit message test case #### ##
    ## ######################################################### */
    const goodCommitMessage = 'chore: unit test this thing';

    const oneGood_commitsListResponse = {
        data: [
            {
                html_url: fakeCommitUrl,
                commit: {
                    message: goodCommitMessage
                }
            }
        ]
    }

    const oneGood_lintReportResponse ={
        valid: true,
        errors: [],
        warnings: [],
        input: goodCommitMessage
    };

    const oneGood_expectedUpdateCheck = {
        check_run_id: fakeCheckId,
        name: sinon.match.string,
        details_url: sinon.match(u => new URL(u)),
        started_at: sinon.match(t => Date.parse(t)),
        status: 'completed',
        conclusion: 'success',
        completed_at: sinon.match(t => Date.parse(t)),
        output: {
            title: 'Good Job!',
            summary: 'Nothing to do here, no one told me you\'re a commit-message-master'
        }
    }

    /* ####################################################### ##
    ## #### Fixtures for 1 error commit message test case #### ##
    ## ####################################################### */
    const errorCommitMessage = 'it doesn\'t matter what you stash';

    const oneError_commitsListResponse = {
        data: [
            {
                html_url: fakeCommitUrl,
                commit: {
                    message: errorCommitMessage
                }
            }
        ]
    }

    const oneError_lintReportResponse ={
        valid: false,
        errors: [
            {
                level: 2,
                valid: false,
                name: 'subject-empty',
                message: 'subject may not be empty'
            },
            {
                level: 2,
                valid: false,
                name: 'type-empty',
                message: 'type may not be empty'
            }
        ],
        warnings: [],
        input: errorCommitMessage
    };

    const oneError_expectedUpdateCheck = {
        check_run_id: fakeCheckId,
        name: sinon.match.string,
        details_url: sinon.match(u => new URL(u)),
        started_at: sinon.match(t => Date.parse(t)),
        status: 'completed',
        conclusion: 'failure',
        completed_at: sinon.match(t => Date.parse(t)),
        output: {
            title: 'Linting Failed',
            summary: 'Oops, looks like we got 1 non-conventional commit message',
            text: [
                `### ${fakeCommitUrl}`,
                '```',
                errorCommitMessage,
                '```',
                '#### Errors',
                '| name | level | message |',
                '| - | - | - |',
                '| subject-empty | 2 | subject may not be empty |',
                '| type-empty | 2 | type may not be empty |'
            ].join(EOL)
        }
    }

    /* ######################################################### ##
    ## #### Fixtures for 1 warning commit message test case #### ##
    ## ######################################################### */
    const warningCommitMessageBody = 'missing line break';
    const warningCommitMessage = `${goodCommitMessage}${EOL}${warningCommitMessageBody}`;

    const oneWarning_commitsListResponse = {
        data: [
            {
                html_url: fakeCommitUrl,
                commit: {
                    message: warningCommitMessage
                }
            }
        ]
    }

    const oneWarning_lintReportResponse ={
        valid: true,
        errors: [],
        warnings: [
            {
                level: 1,
                valid: false,
                name: 'body-leading-blank',
                message: 'body must have leading blank line'
            }
        ],
        input: warningCommitMessage
    };

    const oneWarning_expectedUpdateCheck = {
        check_run_id: fakeCheckId,
        name: sinon.match.string,
        details_url: sinon.match(u => new URL(u)),
        started_at: sinon.match(t => Date.parse(t)),
        status: 'completed',
        conclusion: 'success',
        completed_at: sinon.match(t => Date.parse(t)),
        output: {
            title: 'Linting Found Warnings',
            summary: 'Hmmm... we got 1 warning you might want to look at',
            text: [
                `### ${fakeCommitUrl}`,
                '```',
                STUB_COMMITLINT ? goodCommitMessage : goodCommitMessage + EOL, // TODO: y is this?
                warningCommitMessageBody,
                '```',
                '#### Warnings',
                '| name | level | message |',
                '| - | - | - |',
                '| body-leading-blank | 1 | body must have leading blank line |'
            ].join(EOL)
        }
    }

    /* #################################################################### ##
    ## #### Fixtures for 1 warning + 1 error commit messages test case #### ##
    ## #################################################################### */
    const oneWarningOneError_commitsListResponse = {
        data: [
            {
                html_url: fakeCommitUrl,
                commit: {
                    message: warningCommitMessage
                }
            },
            {
                html_url: fakeCommitUrl,
                commit: {
                    message: errorCommitMessage
                }
            },
            {
                html_url: fakeCommitUrl,
                commit: {
                    message: goodCommitMessage
                }
            }
        ]
    }

    const oneWarningOneError_expectedUpdateCheck = {
        check_run_id: fakeCheckId,
        name: sinon.match.string,
        details_url: sinon.match(u => new URL(u)),
        started_at: sinon.match(t => Date.parse(t)),
        status: 'completed',
        conclusion: 'failure',
        completed_at: sinon.match(t => Date.parse(t)),
        output: {
            title: 'Linting Failed',
            summary: 'Oops, looks like we got 1 errors, and 1 warnings',
            text: [
                `### ${fakeCommitUrl}`,
                '```',
                `${errorCommitMessage}`,
                '```',
                '#### Errors',
                '| name | level | message |',
                '| - | - | - |',
                '| subject-empty | 2 | subject may not be empty |',
                '| type-empty | 2 | type may not be empty |',
                `### ${fakeCommitUrl}`,
                '```',
                STUB_COMMITLINT ? goodCommitMessage : goodCommitMessage + EOL, // TODO: y is this?
                warningCommitMessageBody,
                '```',
                '#### Warnings',
                '| name | level | message |',
                '| - | - | - |',
                '| body-leading-blank | 1 | body must have leading blank line |'
            ].join(EOL)
        }
    }

    /* ############################ ##
    ## #### Dynamic Test Cases #### ##
    ## ############################ */
    let testCases = [
        {
            testTitle: 'Test with one warning commit message, expect one warning report',
            commitMessage: warningCommitMessage,
            stubCommitsList: oneWarning_commitsListResponse,
            stubLintResponse: oneWarning_lintReportResponse,
            expectedUpdateCheck: oneWarning_expectedUpdateCheck
        },
        {
            testTitle: 'Test with one error commit message, expect one error report',
            commitMessage: errorCommitMessage,
            stubCommitsList: oneError_commitsListResponse,
            stubLintResponse: oneError_lintReportResponse,
            expectedUpdateCheck: oneError_expectedUpdateCheck
        },
        {
            testTitle: 'Test with one good commit message, expect a successful result',
            commitMessage: goodCommitMessage,
            stubCommitsList: oneGood_commitsListResponse,
            stubLintResponse: oneGood_lintReportResponse,
            expectedUpdateCheck: oneGood_expectedUpdateCheck
        },
    ];

    /* ######################### ##
    ## #### Stubs and Fakes #### ##
    ## ######################### */
    let loadSpy;
    let lintStub;
    let createCheckStub;
    let repoFuncStub;
    let pullRequestFuncStub;
    let listCommitsStub;
    let updateCheckStub;

    let fakeContext = {};

    beforeEach(() => {
        // unwrap any previous wrapped sinon objects
        sinon.restore();
        // create stubs for the context functions
        lintStub = sinon.stub();
        createCheckStub = sinon.stub();
        repoFuncStub = sinon.stub();
        pullRequestFuncStub = sinon.stub();
        listCommitsStub = sinon.stub();
        updateCheckStub = sinon.stub();
        if (STUB_COMMITLINT) {
            // use rewire inject the lint stub to the handler
            prConventionalCommitsHandler.__set__('lint', lintStub);
        }
        // wrap spy on load configuration
        let loadConfig = prConventionalCommitsHandler.__get__('load');
        loadSpy = sinon.spy(loadConfig);
        prConventionalCommitsHandler.__set__('load', loadSpy);

        /* ###################### ##
        ## #### Fake Context #### ##
        ## ###################### */
        // create a fake context for invoking the application with
        fakeContext = {
            payload: {
                pull_request: {
                    head: {
                        sha: fakeSha
                    },
                    number: fakePRNumber
                }
            },
            octokit: {
                checks: {
                    create: createCheckStub,
                    update: updateCheckStub
                },
                rest: {
                    pulls: {
                        listCommits: listCommitsStub
                    }
                }
            },
            repo: repoFuncStub,
            pullRequest: pullRequestFuncStub
        };
        /* ######################### ##
        ## #### Shared Stubbing #### ##
        ## ######################### */
        // given the repo function will loop back the first argument it gets
        repoFuncStub.returnsArg(0);
        // given the pullRequest function return the list commits arg
        pullRequestFuncStub.returns(expectedListCommitsInfo);
        // given the create check function will resolve to the fake response
        createCheckStub.resolves(createCheckResponse);
    });

    testCases.forEach(testCase => {
        test(testCase.testTitle, async () => {
            // given the linting tool will resolve to the stubbed response
            lintStub // this has no effect when testing with STUB_COMMITLINT=false
                .withArgs(testCase.commitMessage, sinon.match.any, sinon.match.any)
                .resolves(testCase.stubLintResponse);
            // given the list commits service will resolve to the stubbed response
            listCommitsStub.resolves(testCase.stubCommitsList);

            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await prConventionalCommitsHandler(fakeContext, sinon.fake(), new Date().toISOString());

            // then expect the following functions invocation flow
            expect(repoFuncStub).to.have.calledWith(expectedCreateCheckRunInfo);
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);

            expect(pullRequestFuncStub).to.have.calledOnceWith();
            expect(listCommitsStub).to.have.been.calledOnceWith(expectedListCommitsInfo);

            expect(repoFuncStub).to.have.calledWith(testCase.expectedUpdateCheck);
            expect(updateCheckStub).to.have.been.calledOnceWith(testCase.expectedUpdateCheck);

            // expect the load config to be called with the default configuration
            expect(loadSpy).to.have.been.calledOnceWith({
                extends: ['@commitlint/config-conventional'],
            });
        })
    });

    test('Test with one warning, one error, and one good commit message, expect a report for warning and error', async () => {
        // given the linting tool will resolve to the stubbed responses
        lintStub // this has no effect when testing with STUB_COMMITLINT=false
            .withArgs(warningCommitMessage, sinon.match.any, sinon.match.any)
            .resolves(oneWarning_lintReportResponse);
        lintStub // this has no effect when testing with STUB_COMMITLINT=false
            .withArgs(errorCommitMessage, sinon.match.any, sinon.match.any)
            .resolves(oneError_lintReportResponse);
        lintStub // this has no effect when testing with STUB_COMMITLINT=false
            .withArgs(goodCommitMessage, sinon.match.any, sinon.match.any)
            .resolves(oneGood_lintReportResponse);
        // given the list commits service will resolve to the stubbed response
        listCommitsStub.resolves(oneWarningOneError_commitsListResponse);

        // when invoking the handler with the fake context, a fake config, and a iso timestamp
        await prConventionalCommitsHandler(fakeContext, sinon.fake(), new Date().toISOString());

        // then expect the following functions invocation flow
        expect(repoFuncStub).to.have.calledWith(expectedCreateCheckRunInfo);
        expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);

        expect(pullRequestFuncStub).to.have.calledOnceWith();
        expect(listCommitsStub).to.have.been.calledOnceWith(expectedListCommitsInfo);

        expect(repoFuncStub).to.have.calledWith(oneWarningOneError_expectedUpdateCheck);
        expect(updateCheckStub).to.have.been.calledOnceWith(oneWarningOneError_expectedUpdateCheck);

        // expect the load config to be called with the default configuration
        expect(loadSpy).to.have.been.calledOnceWith({
            extends: ['@commitlint/config-conventional'],
        });
    })
});
