const chai = require('chai');
const sinon = require('sinon');
const { beforeEach } = require('mocha');

chai.use(require('sinon-chai'));

const expect = chai.expect;
const sut = require('../../src/handlers/pr-tasks-list');

const EOL = require('os').EOL;

suite('Testing the pr-tasks-list handler', () => {
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

        let baseFakeContext;

        const fakeSha = '#f54dda543@';
        const fakeCheckId = 13;
        const fakeOwner = 'jonDoe';
        const fakeRepository = 'aProject';

        // expected objects
        let baseExpectedUpdateCheck = {
            owner: fakeOwner,
            repo: fakeRepository,
            check_run_id: fakeCheckId,
            name: sinon.match.string,
            details_url: sinon.match(u => new URL(u)),
            started_at: sinon.match(t => Date.parse(t)),
            status: 'completed',
            completed_at: sinon.match(t => Date.parse(t)),
        }
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
            // create a fake context for invoking the application with (base)
            baseFakeContext = Object.freeze({
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
            });
        });

        test('Test with all tasks checked, expect the check to pass with a summary of the completed tasks', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'success',
                output: {
                    title: 'All Done!',
                    summary: 'You made it through',
                    text: [
                        '### Here\'s a list of your accomplishments',
                        '- task 1',
                        '- task 2',
                        '- task 3'
                    ].join(EOL)
                }
            }};
            // given the context will be stubbed with the sut pr body
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.pull_request.body = [
                '- [x] task 1',
                '- [x] task 2',
                '- [x] task 3'
            ].join(EOL);
            // when invoking the handler with the fake context, no config, and a iso timestamp
            await sut.run(fakeContext, undefined, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
        });

        test('Test with unchecked tasks, expect the check to fail with a report of the not yet completed tasks', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'failure',
                output: {
                    title: 'Found 2 unchecked tasks',
                    summary: 'I\'m sure you know what do with these',
                    text: [
                        '### The following tasks needs to be completed',
                        '- task 2',
                        '- task 3'
                    ].join(EOL)
                }
            }};
            // given the context will be stubbed with the sut pr body
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.pull_request.body = [
                '- [x] task 1',
                '- [ ] task 2',
                '- [ ] task 3'
            ].join(EOL);
            // when invoking the handler with the fake context, no config, and a iso timestamp
            await sut.run(fakeContext, undefined, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
        });

        test('Test with not tasks, expect the check to fail providing notification indicating no tasks found', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'success',
                output: {
                    title: 'No tasks lists found',
                    summary: 'Nothing for me to do here'
                }
            }};
            // given the context will be stubbed with the sut pr body
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.pull_request.body = [
                '- [] task 1',
                '- task 2',
                '- ( ) task 3'
            ].join(EOL);
            // when invoking the handler with the fake context, no config, and a iso timestamp
            await sut.run(fakeContext, undefined, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
        });
    });
});
