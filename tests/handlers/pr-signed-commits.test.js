import chai, { expect } from 'chai'
import sinonChai from 'sinon-chai'
import sinon from 'sinon'
import { beforeEach } from 'mocha'
import { EOL } from 'node:os'
import { cloneDeep } from 'lodash-es'

chai.use(sinonChai)

import sut, { runWrapper } from '../../src/handlers/pr-signed-commits.js'

suite('Testing the pr-signed-commits handler', () => {
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
        let pullRequestFuncStub;
        let listCommitsStub;
        let updateCheckStub;

        let fakeContext;

        const fakeSha = '#f54dda543@';
        const fakeCheckId = 13;
        const fakePRNumber = 66;
        const fakeOwner = 'jonDoe';
        const fakeRepository = 'aProject';
        const fakeCommitUrl = `https://fake.commit.url/${fakeSha}`;
        const fakeAuthorName = 'Elias Author';
        const fakeAuthorEmail = 'elias.author@fake.mil';
        const fakeCommitterName = 'Ezekiel Committer';
        const fakeCommitterEmail = 'ezekiel.committer@fake.mil';
        const fakeUnknownName = 'Some Other';
        const fakeUnknownEmail = 'some.other@email.address';
        const fakeBotName = 'dependabot[bot]';
        const fakeBotEmail = '49699333+dependabot[bot]@users.noreply.github.com';

        // the email addresses we use for testing fail (and rightfully so) mx and smtp tests
        // so for testing purposes, we turn these off (except in one test specifically)
        const emailTestOpts = {validateMx: false, validateSMTP: false}

        // expected objects
        const expectedCreateCheckRunInfo = {
            owner: fakeOwner,
            repo: fakeRepository,
            head_sha: fakeSha,
            name: sinon.match.string,
            details_url: sinon.match(u => new URL(u)),
            started_at: sinon.match(t => Date.parse(t)),
            status: 'in_progress'
        };
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
        const successExpectedUpdateCheck = {
            ...baseExpectedUpdateCheck,
            conclusion: 'success',
            output: {
                title: 'Well Done!',
                summary: 'All commits are signed'
            }
        };
        const failureExpectedUpdateCheck = {
            ...baseExpectedUpdateCheck,
            conclusion: 'failure',
            output: {
                title: 'Found 1 unsigned commits',
                summary: 'We need to get the these commits signed',
                text: `- ${fakeCommitUrl}`
            }
        };
        const apiFailExpectedUpdateCheck = {
            ...baseExpectedUpdateCheck,
            conclusion: 'failure',
            output: {
                title: 'No commits found',
                summary: 'Unable to fetch commits from GH API'
            }
        };
        const baseCommitObject = {
            html_url: fakeCommitUrl,
            commit: {
                author: {
                    name: fakeAuthorName,
                    email: fakeAuthorEmail
                },
                committer: {
                    name: fakeCommitterName,
                    email: fakeCommitterEmail
                }

            }
        };
        const commitUnsignedBot = {
            html_url: fakeCommitUrl,
            commit: {
                message: 'this commit is not signed',
                author: {
                    name: fakeBotName,
                    email: fakeBotEmail
                },
                committer: {
                    name: fakeBotName,
                    email: fakeBotEmail
                }

            }
        };

        // function responses
        const createCheckResponse = { data: { id: fakeCheckId } };
        const getRepositoryInfoResponse = { owner: fakeOwner, repo: fakeRepository };
        const getPullRequestInfoResponse = { ...getRepositoryInfoResponse ,pull_number: fakePRNumber };

        // commit objects
        const commitSignedByAuthor = cloneDeep(baseCommitObject);
        commitSignedByAuthor.commit.message = `this is a commit signed by the author${EOL}${EOL}Signed-off-by: ${fakeAuthorName} <${fakeAuthorEmail}>`;

        const commitSignedByCommitter = cloneDeep(baseCommitObject);
        commitSignedByCommitter.commit.message =  `this is a commit signed by the committer${EOL}${EOL}Signed-off-by: ${fakeCommitterName} <${fakeCommitterEmail}>`;

        const commitSignedByUnknown = cloneDeep(baseCommitObject);
        commitSignedByUnknown.commit.message = `this is a commit signed by an unknown${EOL}${EOL}Signed-off-by: ${fakeUnknownName} <${fakeUnknownEmail}>`;

        const commitUnsigned = cloneDeep(baseCommitObject);
        commitUnsigned.commit.message = 'this commit is not signed';

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
            // create a fake context for invoking the application with)
            fakeContext = {
                payload: {
                    pull_request: {
                        head: {
                            sha: fakeSha
                        },
                        number: fakePRNumber
                    },
                    sender: {
                        type: 'User'
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
        });

        [
            {
                testTitle: 'Test with one commit signed by the author',
                signedEmail: fakeAuthorEmail,
                stubCommitsList: {status: 200, data: [commitSignedByAuthor]},
            },
            {
                testTitle: 'Test with one commit signed by the committer',
                signedEmail: fakeCommitterEmail,
                stubCommitsList: {status: 200, data: [commitSignedByCommitter]},
            },
            {
                testTitle: 'Test with two commits signed by the author',
                signedEmail: fakeAuthorEmail,
                stubCommitsList: {status: 200, data: [commitSignedByAuthor, commitSignedByAuthor]},
            },
        ].forEach(testCase => {
            test(`${testCase.testTitle}, expect a successful check run`, async () => {
                // given the list commits service will resolve to the stubbed response
                listCommitsStub.resolves(testCase.stubCommitsList);
                // when invoking the handler with the fake context, no config, and an iso timestamp
                await runWrapper(emailTestOpts)(fakeContext, undefined, new Date().toISOString());
                // then verify a check run to be created and updated as expected
                expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
                expect(updateCheckStub).to.have.been.calledOnceWith(successExpectedUpdateCheck);
            })
        });

        [
            {
                testTitle: 'Test with one commit signed by someone else (not author/committer)',
                stubCommitsList: {status: 200, data: [commitSignedByUnknown]},
            },
            {
                testTitle: 'Test with one unsigned commit',
                stubCommitsList: {status: 200, data: [commitUnsigned]},
            }
        ].forEach(testCase => {
            test(`${testCase.testTitle}, expect a failed check run`, async () => {
                // given the list commits service will resolve to the stubbed response
                listCommitsStub.resolves(testCase.stubCommitsList);
                // when invoking the handler with the fake context, no config, and an iso timestamp
                await runWrapper(emailTestOpts)(fakeContext, undefined, new Date().toISOString());
                // then verify a check run to be created and updated as expected
                expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
                expect(updateCheckStub).to.have.been.calledOnceWith(failureExpectedUpdateCheck);
            })
        });

        test('Test with two commits, one unsigned and one signed by the author, expect a failed check run', async () => {
            // given the list commits service will resolve to the stubbed response
            listCommitsStub.resolves({status: 200, data: [commitUnsigned, commitSignedByAuthor]});
            // when invoking the handler with the fake context, no config, and an iso timestamp
            await runWrapper(emailTestOpts)(fakeContext, undefined, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(failureExpectedUpdateCheck);
        });

        test(`Test a faulty email address, expect a failed check run`, async () => {
            // given the list commits service will resolve to the stubbed response
            listCommitsStub.resolves({status: 200, data: [commitSignedByAuthor]});
            // when invoking the handler with the fake context, no config, and an iso timestamp
            // without our testing email options, our tests are expected to fail mx and smtp tests
            await runWrapper({})(fakeContext, undefined, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(failureExpectedUpdateCheck);
        })

        test('Test with one commit signed by a Bot, not author or committer, expect a successful check run', async () => {
            // given the list commits service will resolve to one commit signed by an unknown user
            listCommitsStub.resolves({status: 200, data: [commitUnsignedBot]});
            // when invoking the handler with the fake context, no config, and an iso timestamp
            await runWrapper(emailTestOpts)(fakeContext, undefined, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(successExpectedUpdateCheck);
        })

        test('Test with two commits, one is unsigned by bot, and one signed by author, expect a successful check run', async () => {
            // given the list commits service will resolve to one commit signed by an unknown user
            listCommitsStub.resolves({status: 200, data: [commitUnsignedBot, commitSignedByAuthor]});
            // when invoking the handler with the fake context, no config, and an iso timestamp
            await runWrapper(emailTestOpts)(fakeContext, undefined, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(successExpectedUpdateCheck);
        });

        [
            {
                name: 'email',
                conf: {ignore: {emails: [fakeAuthorEmail]}}
            },
            {
                name: 'user name',
                conf: {ignore: {users: [fakeAuthorName]}}
            }
        ].forEach(testCase => {
            test(`Test ignored ${testCase.name} is ignored, expect a successful check run`, async () => {
                // given the list commits service will resolve to one commit signed by an unknown user
                listCommitsStub.resolves({status: 200, data: [commitSignedByAuthor]});
                // when invoking the handler with the fake context, a fake config, and an iso timestamp
                await runWrapper(emailTestOpts)(fakeContext, testCase.conf, new Date().toISOString());
                // then verify a check run to be created and updated as expected
                expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
                expect(updateCheckStub).to.have.been.calledOnceWith(successExpectedUpdateCheck);
            })
        });

        test('Test with listCommits API endpoint response not successful, expect a report indicating a possible API error', async () => {
            // given the list commits service will resolve to one commit signed by an unknown user
            listCommitsStub.resolves({status: 300, message: 'this is my message'});
            // when invoking the handler with the fake context, no config, and an iso timestamp
            await runWrapper(emailTestOpts)(fakeContext, undefined, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(apiFailExpectedUpdateCheck);
        });

        test('Test with listCommits API response endpoint promise rejection, expect a report indicating a possible API error', async () => {
            // given the list commits service will resolve to one commit signed by an unknown user
            listCommitsStub.rejects('because I said so');
            // when invoking the handler with the fake context, no config, and an iso timestamp
            await runWrapper(emailTestOpts)(fakeContext, undefined, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(apiFailExpectedUpdateCheck);
        });
    });
});
