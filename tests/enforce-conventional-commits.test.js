const sinon = require('sinon');
const chai = require('chai');

chai.use(require('sinon-chai'));

const enforceConventionalCommits = require('../src/handlers/enforce-conventional-commits');

const expect = chai.expect;

suite('Testing the enforce-conventional-commits handler', () => {
    // fake testing data
    const fakeSha = '#f54dda543@';
    const fakeCheckId = 13;
    const fakePRNumber = 66;
    const fakeCommitUrl = `https://fake.commit.url/${fakeSha}`;
    // fake commit messages
    const goodCommitMessage = 'chore: unit test this thing';
    const errorCommitMessage = 'it doesn\'t matter what you read';
    const commitMessageBody = 'missing line break';
    const warningCommitMessage = `${goodCommitMessage}\r\n${commitMessageBody}`;

    // the expected arg for creating a new check run
    const createCheckArg = {
        head_sha: fakeSha,
        name: sinon.match.string,
        details_url: sinon.match(u => new URL(u)),
        started_at: sinon.match(t => Date.parse(t)),
        status: 'in_progress'
    };
    // the expected response for creating a new check run
    const createCheckResponse = {
        data: {
            id: fakeCheckId
        }
    };

    // the expected arg for listing all the commits
    const listCommitsArg = {
        pull_number: fakePRNumber
    };

    // the expected response for listing all the commits with 1 good commit
    const listCommitsWithGoodResponse = {
        data: [
            {
                html_url: fakeCommitUrl,
                commit: {
                    message: goodCommitMessage
                }
            }
        ]
    }
    // the expected argument for updating the existing check run with 1 good commit
    const updateCheckGoodArg = {
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

    // the expected response for listing all the commits with 1 good commit
    const listCommitsWithErrorResponse = {
        data: [
            {
                html_url: fakeCommitUrl,
                commit: {
                    message: errorCommitMessage
                }
            }
        ]
    }
    // the expected argument for updating the existing check run with 1 error commit
    const updateCheckErrorArg = {
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
            ].join('\r\n')
        }
    }

    // the expected response for listing all the commits with 1 warning commit
    const listCommitsWithWarningResponse = {
        data: [
            {
                html_url: fakeCommitUrl,
                commit: {
                    message: warningCommitMessage
                }
            }
        ]
    }
    // the expected argument for updating the existing check run with 1 warning commit
    const updateCheckWarningArg = {
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
            text: `### ${fakeCommitUrl}\r\n` +
                '```\r\n' +
                `${goodCommitMessage}\n` +
                '\n' +
                `${commitMessageBody}\r\n` +
                '```\r\n' +
                '#### Warnings\r\n' +
                '| name | level | message |\r\n' +
                '| - | - | - |\r\n' +
                '| body-leading-blank | 1 | body must have leading blank line |'
        }
    }

    // the expected response for listing all the commits with 1 warning and 1 error commits
    const listCommitsWithWarningAndErrorResponse = {
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
            }
        ]
    }
    // the expected argument for updating the existing check run with 1 warning commit
    const updateCheckWarningAndErrorArg = {
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
            text: `### ${fakeCommitUrl}\r\n` +
                '```\r\n' +
                `${errorCommitMessage}\r\n` +
                '```\r\n' +
                '#### Errors\r\n' +
                '| name | level | message |\r\n' +
                '| - | - | - |\r\n' +
                '| subject-empty | 2 | subject may not be empty |\r\n' +
                '| type-empty | 2 | type may not be empty |\r\n' +
                `### ${fakeCommitUrl}\r\n` +
                '```\r\n' +
                `${goodCommitMessage}\n` +
                '\n' +
                `${commitMessageBody}\r\n` +
                '```\r\n' +
                '#### Warnings\r\n' +
                '| name | level | message |\r\n' +
                '| - | - | - |\r\n' +
                '| body-leading-blank | 1 | body must have leading blank line |'
        }
    }

    // create dynamic test cases
    let testCases = [
        {
            testTitle: 'Test with one warning commit, reports warning',
            listCommitsResponse: listCommitsWithWarningResponse,
            expectedUpdateCheckArg: updateCheckWarningArg
        },
        {
            testTitle: 'Test with one error commit, reports error',
            listCommitsResponse: listCommitsWithErrorResponse,
            expectedUpdateCheckArg: updateCheckErrorArg
        },
        {
            testTitle: 'Test with one good commit, reports success',
            listCommitsResponse: listCommitsWithGoodResponse,
            expectedUpdateCheckArg: updateCheckGoodArg
        },
        {
            testTitle: 'Test with one warning commit and one error, reports both',
            listCommitsResponse: listCommitsWithWarningAndErrorResponse,
            expectedUpdateCheckArg: updateCheckWarningAndErrorArg
        }
    ];

    testCases.forEach(testCase => {
        test(testCase.testTitle, async () => {
            // create stubs for the context functions
            let createCheckStub = sinon.stub();
            let repoFuncStub = sinon.stub();
            let listCommitsStub = sinon.stub();
            let updateCheckStub = sinon.stub();
            // create a fake context for invoking the application with
            let fakeContext = {
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
                repo: repoFuncStub
            };
            // given the repo function will loop back the first argument it gets
            repoFuncStub.returnsArg(0);
            // given the create check function will resolve to the fake response
            createCheckStub.resolves(createCheckResponse);
            // given the list commits function will resolve to the expected response
            listCommitsStub.resolves(testCase.listCommitsResponse);

            // when invoking the handler with the fake context
            await enforceConventionalCommits(fakeContext);

            // then expect the following functions invocation flow
            expect(repoFuncStub).to.have.calledWith(createCheckArg);
            expect(createCheckStub).to.have.been.calledOnceWith(createCheckArg);

            expect(repoFuncStub).to.have.calledWith(listCommitsArg);
            expect(listCommitsStub).to.have.been.calledOnceWith(listCommitsArg);

            expect(repoFuncStub).to.have.calledWith(testCase.expectedUpdateCheckArg);
            expect(updateCheckStub).to.have.been.calledOnceWith(testCase.expectedUpdateCheckArg);
        })
    });
});
