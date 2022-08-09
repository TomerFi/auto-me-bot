const chai = require('chai');
const rewire = require('rewire');
const sinon = require('sinon');
const { beforeEach } = require('mocha');
const { EOL } = require('os');

chai.use(require('sinon-chai'));

const prConventionalCommitsHandler = rewire('../../src/handlers/pr-conventional-commits');
const expect = chai.expect;

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

    const oneError_expectedUpdateCheck = {
        check_run_id: fakeCheckId,
        name: sinon.match.string,
        details_url: sinon.match(u => new URL(u)),
        started_at: sinon.match(t => Date.parse(t)),
        status: 'completed',
        conclusion: 'failure',
        completed_at: sinon.match(t => Date.parse(t)),
        output: {
            title: 'Found 1 non-conventional commit message',
            summary: 'We need to amend these commits messages',
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

    const oneWarning_expectedUpdateCheck = {
        check_run_id: fakeCheckId,
        name: sinon.match.string,
        details_url: sinon.match(u => new URL(u)),
        started_at: sinon.match(t => Date.parse(t)),
        status: 'completed',
        conclusion: 'success',
        completed_at: sinon.match(t => Date.parse(t)),
        output: {
            title: 'Found 1 non-conventional commit message',
            summary: 'Take a look at these',
            text: [
                `### ${fakeCommitUrl}`,
                '```',
                goodCommitMessage + EOL,
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
            title: 'Found 2 non-conventional commit messages',
            summary: 'We need to amend these commits messages',
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
                goodCommitMessage + EOL,
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
    ## #### Fixtures for 1 error custom rule test case #### ##
    ## #################################################################### */

    const errorCommitMessageBody = 'Lorem ipsum dolor sit amet';
    const longCommitBodyMsg = `${goodCommitMessage}${EOL}${EOL}${errorCommitMessageBody}`;
    const oneErrorCustom_commitsListResponse = {
        data: [
            {
                html_url: fakeCommitUrl,
                commit: {
                    message: longCommitBodyMsg
                }
            },
        ]
    }

    const oneErrorCustom_expectedUpdateCheck = {
        check_run_id: fakeCheckId,
        name: sinon.match.string,
        details_url: sinon.match(u => new URL(u)),
        started_at: sinon.match(t => Date.parse(t)),
        status: 'completed',
        conclusion: 'failure',
        completed_at: sinon.match(t => Date.parse(t)),
        output: {
            title: 'Found 1 non-conventional commit message',
            summary: 'We need to amend these commits messages',
            text: [
                `### ${fakeCommitUrl}`,
                '```',
                goodCommitMessage + EOL,
                errorCommitMessageBody,
                '```',
                '#### Errors',
                '| name | level | message |',
                '| - | - | - |',
                '| body-max-line-length | 2 | body\'s lines must not be longer than 10 characters |'
            ].join(EOL)
        }
    }

    /* ############################ ##
    ## #### Dynamic Test Cases #### ##
    ## ############################ */
    let testCases = [
        {
            testTitle: 'Test with one warning commit message, expect one warning report',
            stubCommitsList: oneWarning_commitsListResponse,
            expectedUpdateCheck: oneWarning_expectedUpdateCheck
        },
        {
            testTitle: 'Test with one error commit message, expect one error report',
            stubCommitsList: oneError_commitsListResponse,
            expectedUpdateCheck: oneError_expectedUpdateCheck
        },
        {
            testTitle: 'Test with one good commit message, expect a successful result',
            stubCommitsList: oneGood_commitsListResponse,
            expectedUpdateCheck: oneGood_expectedUpdateCheck
        },
    ];

    /* ######################### ##
    ## #### Stubs and Fakes #### ##
    ## ######################### */
    let loadSpy;
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
        createCheckStub = sinon.stub();
        repoFuncStub = sinon.stub();
        pullRequestFuncStub = sinon.stub();
        listCommitsStub = sinon.stub();
        updateCheckStub = sinon.stub();
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
            // given the list commits service will resolve to the stubbed response
            listCommitsStub.resolves(testCase.stubCommitsList);

            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await prConventionalCommitsHandler(fakeContext, sinon.fake(), new Date().toISOString());

            // then expect the following functions invocation flow
            expect(repoFuncStub).to.have.been.calledWith(expectedCreateCheckRunInfo);
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);

            expect(pullRequestFuncStub).to.have.been.calledOnceWith();
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
        // given the list commits service will resolve to the stubbed response
        listCommitsStub.resolves(oneWarningOneError_commitsListResponse);

        // when invoking the handler with the fake context, a fake config, and a iso timestamp
        await prConventionalCommitsHandler(fakeContext, sinon.fake(), new Date().toISOString());

        // then expect the following functions invocation flow
        expect(repoFuncStub).to.have.calledWith(expectedCreateCheckRunInfo);
        expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);

        expect(pullRequestFuncStub).to.have.been.calledOnceWith();
        expect(listCommitsStub).to.have.been.calledOnceWith(expectedListCommitsInfo);

        expect(repoFuncStub).to.have.calledWith(oneWarningOneError_expectedUpdateCheck);
        expect(updateCheckStub).to.have.been.calledOnceWith(oneWarningOneError_expectedUpdateCheck);

        // expect the load config to be called with the default configuration
        expect(loadSpy).to.have.been.calledOnceWith({
            extends: ['@commitlint/config-conventional'],
        });
    })

    test('Test with one error and custom commit configuration, expect a report error on custom violation', async () => {
        // given the list commits service will resolve to the stubbed response
        listCommitsStub.resolves(oneErrorCustom_commitsListResponse);
        // given the following pr custom configuration
        let customConfig = {
            rules :{'body-max-line-length': [2, 'always', 10]}
        };
        // when invoking the handler with the fake context, a fake config, and a iso timestamp
        await prConventionalCommitsHandler(fakeContext, customConfig, new Date().toISOString());

        // then expect the following functions invocation flow
        expect(repoFuncStub).to.have.calledWith(expectedCreateCheckRunInfo);
        expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);

        expect(pullRequestFuncStub).to.have.been.calledOnceWith();
        expect(listCommitsStub).to.have.been.calledOnceWith(expectedListCommitsInfo);

        expect(repoFuncStub).to.have.calledWith(oneErrorCustom_expectedUpdateCheck);
        expect(updateCheckStub).to.have.been.calledOnceWith(oneErrorCustom_expectedUpdateCheck);

        // expect the load config to be called with the custom configuration
        expect(loadSpy).to.have.been.calledOnceWith({
            extends: ['@commitlint/config-conventional'],
            rules:{'body-max-line-length': [2, 'always', 10]}
        });
    })
});
