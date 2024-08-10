import chai, { expect } from 'chai'
import sinonChai from 'sinon-chai'
import sinon from 'sinon'
import { beforeEach } from 'mocha'

chai.use(sinonChai)

import sut from '../../src/handlers/pr-auto-approve.js'

suite('Testing the pr-auto-approve handler', () => {
    suite('Test handler matching', () => {
        ['opened', 'synchronize'].forEach(action => {
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
        let createCheckStub;
        let repoFuncStub;
        let updateCheckStub;
        let pullRequestFuncStub;
        let createReviewStub;

        let fakeContext;

        const fakeSha = '#f54dda543@';
        const fakeCheckId = 13;
        const fakePRNumber = 66;
        const fakeOwner = 'jonDoe';
        const fakeRepository = 'aProject';

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
            createReviewStub = sinon.stub(); // stub for context.octokit.pulls.createReview function
            repoFuncStub = sinon.stub(); // stub for context.repo function to short-circuit return the expected response
            repoFuncStub.callsFake((a) => {return { ...getRepositoryInfoResponse, ...a }});
            pullRequestFuncStub = sinon.stub(); //stub for context.pullRequest function to short-circuit return the expected response
            pullRequestFuncStub.callsFake((a) => {return { ...getPullRequestInfoResponse, ...a }});
            // create a fake context for invoking the application with)
            fakeContext = Object.freeze({
                octokit: {
                    checks: {
                        create: createCheckStub,
                        update: updateCheckStub
                    },
                    pulls: {
                        createReview: createReviewStub
                    }
                },
                repo: repoFuncStub,
                pullRequest: pullRequestFuncStub
            });
        });

        async function assertHandlerOperation(isBot, login, type, expectedOutput, config) {
            // create a given context with a stubbed pr title
            let givenContext = {
                ...fakeContext,
                payload: {
                    pull_request: {
                        head: {
                            sha: fakeSha
                        },
                    },
                    sender: {
                        login,
                        type
                    }
                },
                isBot: () => isBot
            }
            // when invoking the handler with the given context, the custom configuration object, and an iso timestamp
            await sut.run(givenContext, config, new Date().toISOString());
            // then verify a check run was created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith({...baseExpectedUpdateCheck, ...expectedOutput});
        }

        test('Test with a bot sender and allBots set to true in the configuration, expect approve event', async () => {
            // given the following custom config
            let customConfig = { allBots: true };
            // expected report output
            let expectedOutput = {
                conclusion: 'success',
                output: {
                    title: 'PR approved!',
                    summary: 'Bot was automatically approved'
                }
            };
            // given the createReviewStub function will resolve to code 200 indicating the review was created successfully
            createReviewStub.resolves({status: 200})
            // assert the api response creates the expected updated check run arg
            await assertHandlerOperation(true, '', 'Bot', expectedOutput, customConfig);
            expect(createReviewStub).to.have.been.calledOnce;
        });

        test('Test with a user sender listed in the configuration, expect approve event', async () => {
            // given the following custom config
            let customConfig = { users: ['fakeUserName'] };
            // expected report output
            let expectedOutput = {
                conclusion: 'success',
                output: {
                    title: 'PR approved!',
                    summary: 'User was automatically approved'
                }
            };
            // given the createReviewStub function will resolve to code 200 indicating the review was created successfully
            createReviewStub.resolves({status: 200})
            // assert the api response creates the expected updated check run arg
            await assertHandlerOperation(true, 'fakeUserName', 'User', expectedOutput, customConfig);
            expect(createReviewStub).to.have.been.calledOnce;
        });

        test('Test with a non listed user in the configuration, expect no event', async () => {
            // given the following custom config
            let customConfig = { users: ['fakeUserName'] };
            // expected report output
            let expectedOutput = {
                conclusion: 'neutral',
                output: {
                    title: 'No automatic approval required',
                    summary: 'Nothing for me to do here'
                }
            };
            // assert the api response creates the expected updated check run arg
            await assertHandlerOperation(true, 'nonListedFakeUser', 'User', expectedOutput, customConfig);
            expect(createReviewStub).to.have.not.been.called;
        });

        test('Test with no configuration, expect no event', async () => {
            // expected report output
            let expectedOutput = {
                conclusion: 'neutral',
                output: {
                    title: 'No automatic approval required',
                    summary: 'Nothing for me to do here'
                }
            };
            // assert the api response creates the expected updated check run arg
            await assertHandlerOperation(true, 'nonListedFakeUser', 'User', expectedOutput, null);
            expect(createReviewStub).to.have.not.been.called;
        });

        test('Test a correct scenario with a non 200 response from the API', async () => {
            // given the following custom config
            let customConfig = { allBots: true };
            // expected report output
            let expectedOutput = {
                conclusion: 'failure',
                output: {
                    title: 'Failed to approve the PR',
                    summary: 'Automatically approval failed',
                    text: 'Got status 500.'
                }
            };
            // given the createReviewStub function will resolve to code 200 indicating the review was created successfully
            createReviewStub.resolves({status: 500})
            // assert the api response creates the expected updated check run arg
            await assertHandlerOperation(true, '', 'Bot', expectedOutput, customConfig);
            expect(createReviewStub).to.have.been.calledOnce;
        });

        test('Test a correct scenario with a rejected response from the API', async () => {
            // given the following custom config
            let customConfig = { allBots: true };
            // expected report output
            let expectedOutput = {
                conclusion: 'failure',
                output: {
                    title: 'Failed to approve the PR',
                    summary: 'Automatically approval failed',
                    text: 'Got error.'
                }
            };
            // given the createReviewStub function will resolve to code 200 indicating the review was created successfully
            createReviewStub.rejects('fakeError')
            // assert the api response creates the expected updated check run arg
            await assertHandlerOperation(true, '', 'Bot', expectedOutput, customConfig);
            expect(createReviewStub).to.have.been.calledOnce;
        });
    });
});
