import chai, { expect } from 'chai'
import sinonChai from 'sinon-chai'
import sinon from 'sinon'
import { beforeEach } from 'mocha'
import { EOL } from 'node:os'

chai.use(sinonChai)

import sut from '../../src/handlers/pr-conventional-title.js'


suite('Testing the pr-conventional-title handler', () => {
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
        let createCheckStub;
        let repoFuncStub;
        let updateCheckStub;

        let fakeContext;

        const fakeSha = '#f54dda543@';
        const fakeCheckId = 13;
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

        beforeEach(() => {
            sinon.restore(); // unwrap any previous wrapped sinon objects

            createCheckStub = sinon.stub(); // stub for context.octokit.checks.create function to short-circuit return the expected response
            createCheckStub.resolves(createCheckResponse);
            updateCheckStub = sinon.stub(); // stub for context.octokit.checks.update function
            updateCheckStub.resolves();
            repoFuncStub = sinon.stub(); // stub for context.repo function to short-circuit return the expected response
            repoFuncStub.callsFake((a) => {return { ...getRepositoryInfoResponse, ...a }});
            // create a fake context for invoking the application with)
            fakeContext = Object.freeze({
                octokit: {
                    checks: {
                        create: createCheckStub,
                        update: updateCheckStub
                    }
                },
                repo: repoFuncStub
            });
        });

        async function assertHandlerOperation(prTitle, expectedOutput, optionalConfig) {
            // create a given context with a stubbed pr title
            let givenContext = {
                ...fakeContext,
                payload: {
                    pull_request: {
                        head: {
                            sha: fakeSha
                        },
                        title: prTitle
                    }
                }
            }
            // when invoking the handler with the given context, the custom configuration object, and an iso timestamp
            await sut.run(givenContext, optionalConfig, new Date().toISOString());
            // then verify a check run was created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith({...baseExpectedUpdateCheck, ...expectedOutput});
        }

        test('Test with a conventional pr title, expect a successful report', async () => {
            // given the following pr title
            let prTitle = 'fix: good conventional title';
            // expected report output
            let expectedOutput = {
                conclusion: 'success',
                output: {
                    title: 'Nice!',
                    summary: 'Good job, the PR title is conventional'
                }
            };
            // assert the api response creates the expected updated check run arg
            await assertHandlerOperation(prTitle, expectedOutput);
        });

        test('Test with a long pr title and a custom config set for warning, expect a successful report with a warning', async () => {
            // given the following custom config (1 = warning)
            let customConfig = { rules :{'header-max-length': [1, 'always', 10]} };
            // given the following pr title
            let prTitle = 'fix: too long custom config is set to 10 but only warning so were cool';
            // expected report output
            let expectedOutput = {
                conclusion: 'success',
                output: {
                    title: 'Got warnings',
                    summary: 'The PR title is conventional, with warnings',
                    text: [
                        `### ${prTitle}`,
                        '#### Warnings',
                        '| name | level | message |',
                        '| - | - | - |',
                        '| header-max-length | 1 | header must not be longer than 10 characters, current length is 70 |'
                    ].join(EOL)
                }
            };
            // assert the api response creates the expected updated check run arg
            await assertHandlerOperation(prTitle, expectedOutput, customConfig);
        });

        test('Test with a long pr title and a custom config set for error, expect a failed report', async () => {
            // given the following custom config (2 = error)
            let customConfig = { rules :{'header-max-length': [2, 'always', 10]} };
            // given the following pr title
            let prTitle = 'fix: too long custom config is set to 10 but only warning so were cool';
            // expected report output
            let expectedOutput = {
                conclusion: 'failure',
                output: {
                    title: 'Not conventional',
                    summary: 'The PR title is not conventional',
                    text: [
                        `### ${prTitle}`,
                        '#### Errors',
                        '| name | level | message |',
                        '| - | - | - |',
                        '| header-max-length | 2 | header must not be longer than 10 characters, current length is 70 |'
                    ].join(EOL)
                }
            };
            // assert the api response creates the expected updated check run arg
            await assertHandlerOperation(prTitle, expectedOutput, customConfig);
        });

    });
});
