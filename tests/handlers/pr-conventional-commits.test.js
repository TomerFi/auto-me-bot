const chai = require('chai');
const rewire = require('rewire');
const sinon = require('sinon');
const { beforeEach } = require('mocha');
const { EOL } = require('os');

chai.use(require('sinon-chai'));

const expect = chai.expect;
const sut = rewire('../../src/handlers/pr-conventional-commits');

suite('Testing the pr-conventional-commits handler', () => {
    suite('Test handler matching', () => {
        ['opened', 'edited', 'synchronize'].forEach(action => {
            test(`Test pull_request event type with ${action} action type, expect a match` , () => {
                expect(sut.match({ payload: { pull_request: {}, action: action } })).to.be.true;
            });
        });

        test('Test pull_request event type with an unknown action type, expect a false match' , () => {
            expect(sut.match({ payload: { pull_request: {}, action: 'unknownAction' } })).to.be.false;
        });

        test('Test an unknown event type, expect a false match', () => {
            expect(sut.match({ payload: { unknownEvent: {}, action: 'opened' } })).to.be.false;
        });
    });

    suite('Test handler running', () => {
        let loadSpy;
        let createCheckStub;
        let repoFuncStub;
        let pullRequestFuncStub;
        let listCommitsStub;
        let updateCheckStub;

        let fakeContext;
        let baseConfig;

        const fakeSha = '#f54dda543@';
        const fakeCheckId = 13;
        const fakePRNumber = 66;
        const fakeOwner = 'jonDoe';
        const fakeRepository = 'aProject';
        const fakeCommitUrl = `https://fake.commit.url/${fakeSha}`;

        // expected objects
        const baseExpectedUpdateCheck = {
            owner: fakeOwner,
            repo: fakeRepository,
            check_run_id: fakeCheckId,
            name: sinon.match.string,
            details_url: sinon.match(u => new URL(u)),
            started_at: sinon.match(t => Date.parse(t)),
            status: 'completed',
            completed_at: sinon.match(t => Date.parse(t)),
        };
        const expectedCreateCheckRunInfo = {
            owner: fakeOwner,
            repo: fakeRepository,
            head_sha: fakeSha,
            name: sinon.match.string,
            details_url: sinon.match(u => new URL(u)),
            started_at: sinon.match(t => Date.parse(t)),
            status: 'in_progress'
        };
        // function responses
        const createCheckResponse = { data: { id: fakeCheckId } };
        const getRepositoryInfoResponse = { owner: fakeOwner, repo: fakeRepository };
        const getPullRequestInfoResponse = { ...getRepositoryInfoResponse ,pull_number: fakePRNumber };

        beforeEach(() => {
            sinon.restore(); // unwrap any previous wrapped sinon objects

            createCheckStub = sinon.stub(); // stub for context.octokit.checks.create function to short-circuit return the expected response
            createCheckStub.resolves(createCheckResponse);
            updateCheckStub = sinon.stub(); // stub for context.octokit.checks.update function
            updateCheckStub.resolves();
            listCommitsStub = sinon.stub(); // stub for context.octokit.rest.pulls.listCommits function
            repoFuncStub = sinon.stub(); // stub for context.repo function to short-circuit return the expected response
            repoFuncStub.callsFake((a) => {return { ...getRepositoryInfoResponse, ...a }});
            pullRequestFuncStub = sinon.stub(); //stub for context.pullRequest function to short-circuit return the expected response
            pullRequestFuncStub.callsFake((a) => {return { ...getPullRequestInfoResponse, ...a }});
            // wrap spy on load configuration
            let loadConfig = sut.__get__('load');
            loadSpy = sinon.spy(loadConfig);
            sut.__set__('load', loadSpy);
            // grab the default configuration for testing usage
            baseConfig = sut.__get__('DEFAULT_CONFIG');
            // create a fake context for invoking the application with)
            fakeContext = Object.freeze({
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
            });
        });

        test('Test with one warning commit message, expect one warning report', async () => {
            // fake api response
            let listCommitsResponse = {
                status: 200,
                data: [
                    {
                        html_url: fakeCommitUrl,
                        commit: {
                            message: `chore: unit test this thing${EOL}missing line break`
                        }
                    }
                ]
            };
            // expected report output
            let expectedUpdateCheck = {
                ...baseExpectedUpdateCheck,
                conclusion: 'success',
                output: {
                    title: 'Found 1 non-conventional commit message',
                    summary: 'Take a look at these',
                    text: [
                        `### ${fakeCommitUrl}`,
                        '```',
                        'chore: unit test this thing' + EOL,
                        'missing line break',
                        '```',
                        '#### Warnings',
                        '| name | level | message |',
                        '| - | - | - |',
                        '| body-leading-blank | 1 | body must have leading blank line |'
                    ].join(EOL)
                }
            };
            // assert the api response creates the expected updated check run arg
            await assertHandlerOperation(listCommitsResponse, expectedUpdateCheck);
        });

        test('Test with one error commit message, expect one error report', async () => {
            // fake api response
            let listCommitsResponse = {
                status: 200,
                data: [
                    {
                        html_url: fakeCommitUrl,
                        commit: {
                            message: 'it doesn\'t matter what you stash'
                        }
                    }
                ]
            };
            // expected report output
            let expectedUpdateCheck = {
                ...baseExpectedUpdateCheck,
                conclusion: 'failure',
                output: {
                    title: 'Found 1 non-conventional commit message',
                    summary: 'We need to amend these commits messages',
                    text: [
                        `### ${fakeCommitUrl}`,
                        '```',
                        'it doesn\'t matter what you stash',
                        '```',
                        '#### Errors',
                        '| name | level | message |',
                        '| - | - | - |',
                        '| subject-empty | 2 | subject may not be empty |',
                        '| type-empty | 2 | type may not be empty |'
                    ].join(EOL)
                }
            };
            // assert the api response creates the expected updated check run arg
            await assertHandlerOperation(listCommitsResponse, expectedUpdateCheck);
        });

        test('Test with one good commit message, expect a successful result', async () => {
            // fake api response
            let listCommitsResponse = {
                status: 200,
                data: [
                    {
                        html_url: fakeCommitUrl,
                        commit: {
                            message: 'chore: unit test this thing'
                        }
                    }
                ]
            };
            // expected report output
            let expectedUpdateCheck = {
                ...baseExpectedUpdateCheck,
                conclusion: 'success',
                output: {
                    title: 'Good Job!',
                    summary: 'Nothing to do here, no one told me you\'re a commit-message-master'
                }
            };
            // assert the api response creates the expected updated check run arg
            await assertHandlerOperation(listCommitsResponse, expectedUpdateCheck);
        });

        test('Test with one warning, one error, and one good commit message, expect a report for both the warning and the error', async () => {
            // fake api response
            let listCommitsResponse = {
                status: 200,
                data: [
                    {
                        html_url: fakeCommitUrl,
                        commit: {
                            message: `chore: unit test this thing${EOL}missing line break`
                        }
                    },
                    {
                        html_url: fakeCommitUrl,
                        commit: {
                            message: 'it doesn\'t matter what you stash'
                        }
                    },
                    {
                        html_url: fakeCommitUrl,
                        commit: {
                            message: 'chore: unit test this thing'
                        }
                    }
                ]
            };
            // expected report output
            let expectedUpdateCheck = {
                ...baseExpectedUpdateCheck,
                conclusion: 'failure',
                output: {
                    title: 'Found 2 non-conventional commit messages',
                    summary: 'We need to amend these commits messages',
                    text: [
                        `### ${fakeCommitUrl}`,
                        '```',
                        'it doesn\'t matter what you stash',
                        '```',
                        '#### Errors',
                        '| name | level | message |',
                        '| - | - | - |',
                        '| subject-empty | 2 | subject may not be empty |',
                        '| type-empty | 2 | type may not be empty |',
                        `### ${fakeCommitUrl}`,
                        '```',
                        'chore: unit test this thing' + EOL,
                        'missing line break',
                        '```',
                        '#### Warnings',
                        '| name | level | message |',
                        '| - | - | - |',
                        '| body-leading-blank | 1 | body must have leading blank line |'
                    ].join(EOL)
                }
            };
            // assert the api response creates the expected updated check run arg
            await assertHandlerOperation(listCommitsResponse, expectedUpdateCheck);
        });

        test('Test with one non-standard error based a custom configuration, expect a report error', async () => {
            // fake api response
            let listCommitsResponse = {
                status: 200,
                data: [
                    {
                        html_url: fakeCommitUrl,
                        commit: {
                            message: `chore: unit test this thing${EOL}${EOL}Lorem ipsum dolor sit amet`
                        }
                    },
                ]
            };
            // expected report output
            let expectedUpdateCheck = {
                ...baseExpectedUpdateCheck,
                conclusion: 'failure',
                output: {
                    title: 'Found 1 non-conventional commit message',
                    summary: 'We need to amend these commits messages',
                    text: [
                        `### ${fakeCommitUrl}`,
                        '```',
                        'chore: unit test this thing' + EOL,
                        'Lorem ipsum dolor sit amet',
                        '```',
                        '#### Errors',
                        '| name | level | message |',
                        '| - | - | - |',
                        '| body-max-line-length | 2 | body\'s lines must not be longer than 10 characters |'
                    ].join(EOL)
                }
            };
            // configuration object setting max line length to 10
            let customConfig = { rules :{'body-max-line-length': [2, 'always', 10]} };
            // assert the api response using the custom configuration creates the expected updated check run arg
            await assertHandlerOperation(listCommitsResponse, expectedUpdateCheck, customConfig);
        });

        async function assertHandlerOperation(listCommitsResponse, expectedUpdateCheck, optionalConfig) {
            // given the listCommits api endpoint will resolve to the fake response
            listCommitsStub.resolves(listCommitsResponse);
            // when invoking the handler with the fake context, the custom configuration object, and an iso timestamp
            await sut.run(fakeContext, optionalConfig, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
            // verify custom configuration is included in the used configuration
            expect(loadSpy).to.have.been.calledOnceWith(optionalConfig ? {...baseConfig, ...optionalConfig} : baseConfig);
        }

        test('Test with listCommits API endpoint response not successful, expect a report indicating a possible API error', async () => {
            // fake api response
            let listCommitsResponse = {
                status: 300,
                message: 'say what'
            };
            // expected report output
            let expectedUpdateCheck = {
                ...baseExpectedUpdateCheck,
                conclusion: 'failure',
                output: {
                    title: 'No commits found',
                    summary: 'Unable to fetch commits from GH API'
                }
            };
            // given the listCommits api endpoint will resolve to the fake response
            listCommitsStub.resolves(listCommitsResponse);
            // when invoking the handler with the fake context, no config, and an iso timestamp
            await sut.run(fakeContext, undefined, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
        });

        test('Test with listCommits API response endpoint promise rejection, expect a report indicating a possible API error', async () => {
            // expected report output
            let expectedUpdateCheck = {
                ...baseExpectedUpdateCheck,
                conclusion: 'failure',
                output: {
                    title: 'No commits found',
                    summary: 'Unable to fetch commits from GH API'
                }
            };
            // given the listCommits api endpoint will resolve to the fake response
            listCommitsStub.rejects('I have my reasons');
            // when invoking the handler with the fake context, no config, and an iso timestamp
            await sut.run(fakeContext, undefined, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
        });
    });
});
