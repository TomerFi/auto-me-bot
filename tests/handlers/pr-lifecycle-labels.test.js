const chai = require('chai');
const sinon = require('sinon');
const { beforeEach } = require('mocha');

chai.use(require('sinon-chai'));

const expect = chai.expect;
const sut = require('../../src/handlers/pr-lifecycle-labels');

suite('Testing the pr-lifecycle-labels', () => {
    suite('Test handler matching', () => {
        ['opened', 'edited', 'synchronize', 'closed', 'ready_for_review', 'reopened'].forEach(action => {
            test(`Test pull_request event type with ${action} action type, expect a match` , () => {
                expect(sut.match({ payload: { pull_request: {}, action: action } })).to.be.true;
            });
        });

        test('Test pull_request event type with an unknown action type, expect a false match' , () => {
            expect(sut.match({ payload: { pull_request: {}, action: 'unknownAction' } })).to.be.false;
        });

        ['submitted', 'edited', 'dismissed'].forEach(action => {
            test(`Test pull_request_review event type with ${action} action type, expect a match` , () => {
                expect(sut.match({ payload: { review: {}, pull_request: {}, action: action } })).to.be.true;
            });
        });

        test('Test pull_request_review event type with an unknown action type, expect a false match' , () => {
            expect(sut.match({ payload: { review: {}, pull_request: {}, action: 'unknownAction' } })).to.be.false;
        });

        test('Test an unknown event type, expect a false match', () => {
            expect(sut.match({ payload: { unknownEvent: {}, action: 'opened' } })).to.be.false;
        });
    });

    suite('Test handler running', () => {
        let createCheckStub;
        let updateCheckStub;
        let getLabelStub;
        let addLabelsStub;
        let removeLabelStub;
        let listReviewStub;
        let branchProtectFuncStub;
        let repoFuncStub;
        let pullRequestFuncStub;

        let baseFakeContext;

        const fakeBaseRef = 'main';
        const fakeHeadSha = '#f54dda543@';
        const fakeCheckId = 13;
        const fakePRNumber = 66;
        const fakeOwner = 'jonDoe';
        const fakeRepository = 'aProject';
        const fakeReviewer1 = 'ReviewerReviewerzon';
        const fakeReviewer2 = 'ReviewerNoLastName';

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
            head_sha: fakeHeadSha,
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
            getLabelStub = sinon.stub(); // stub for context.octokit.issues.getLabel function
            addLabelsStub = sinon.stub(); // stub for context.octokit.issues.addLabels function
            removeLabelStub = sinon.stub(); // stub for context.octokit.issue.removeLabel function
            listReviewStub = sinon.stub(); // stub for context.octokit.pull.listReviews
            branchProtectFuncStub = sinon.stub() // stub for context.octokit.repos.getBranchProtection function
            repoFuncStub = sinon.stub(); // stub for context.repo function to short-circuit return the expected response
            repoFuncStub.callsFake((a) => {return { ...getRepositoryInfoResponse, ...a }});
            pullRequestFuncStub = sinon.stub(); //stub for context.pullRequest function to short-circuit return the expected response
            pullRequestFuncStub.callsFake((a) => {return { ...getPullRequestInfoResponse, ...a }});
            // create a fake context for invoking the application with (base)
            baseFakeContext = Object.freeze({
                payload: {
                    pull_request: {
                        base: {
                            ref: fakeBaseRef
                        },
                        head: {
                            sha: fakeHeadSha
                        },
                        labels: [],
                        number: fakePRNumber
                    }
                },
                octokit: {
                    checks: {
                        create: createCheckStub,
                        update: updateCheckStub
                    },
                    issues: {
                        getLabel: getLabelStub,
                        addLabels: addLabelsStub,
                        removeLabel: removeLabelStub
                    },
                    pulls: {
                        listReviews: listReviewStub
                    },
                    repos: {
                        getBranchProtection: branchProtectFuncStub
                    }
                },
                repo: repoFuncStub,
                pullRequest: pullRequestFuncStub
            });
        });

        test('Test ignore drafts config with a draft pr, expect the check to be skipped', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'skipped',
                output: {
                    title: 'Ignoring drafts',
                    summary: 'I\'m configured to ignore drafts'
                }
            }};
            // given the configuration is set to ignore drafts
            let config = {
                ignoreDrafts: true
            }
            // given the pull request is a draft
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.pull_request.draft = true;
            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await sut.run(fakeContext, config, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
            // then no labels should be added or removed
            expect(removeLabelStub).to.have.not.been.called;
            expect(addLabelsStub).to.have.not.been.called;
        });


        [{}, {ignoreDrafts: false}, {labels: {}}, {labels: {unknownLabel: 'noKnownLabels'}}].forEach(invalidConfig => {
            test(`Test invalid config, ${JSON.stringify(invalidConfig)}, expect the check to be neutral`, async () => {
                // expected check update request parts
                let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                    conclusion: 'neutral',
                    output: {
                        title: 'Nothing for me to do',
                        summary: 'Are you sure your configuration is valid?'
                    }
                }};
                // given the pull request is a draft
                let fakeContext = { ...baseFakeContext }
                fakeContext.payload.pull_request.draft = true;
                // when invoking the handler with the fake context, a fake config, and a iso timestamp
                await sut.run(fakeContext, invalidConfig, new Date().toISOString());
                // then verify a check run to be created and updated as expected
                expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
                expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
                // then no labels should be added or removed
                expect(removeLabelStub).to.have.not.been.called;
                expect(addLabelsStub).to.have.not.been.called;
            });
        })

        test('Test selected lifecycle label not configured, expect the check to succeed', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'success',
                output: {
                    title: 'Label not configured',
                    summary: 'Lifecycle label \'merged\' not configured'
                }
            }};
            // given the configuration is set only for the reviewRequired lifecycle label
            let config = {
                labels: {
                    reviewRequired: 'my custom label'
                }
            }
            // given the pull request is merged
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.action = 'closed';
            fakeContext.payload.pull_request.merged = true;
            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await sut.run(fakeContext, config, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
            // then no labels should be added or removed
            expect(removeLabelStub).to.have.not.been.called;
            expect(addLabelsStub).to.have.not.been.called;
        });

        test('Test with getBranchProtection API endpoint response not successful, expect the check to fail', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'failure',
                output: {
                    title: 'Label for \'merged\' not found',
                    summary: 'Are you sure the \'this pr is merged\' label exists?'
                }
            }};
            // given the merged lifecycle label is configured
            let config = {
                labels: {
                    merged: 'this pr is merged'
                }
            }
            // given the pull request is merged and not already labeled as such
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.action = 'closed';
            fakeContext.payload.pull_request.merged = true;
            fakeContext.payload.pull_request.labels = [{name: 'in review'}]
            // given the getLabel function will return unsuccessful
            getLabelStub.withArgs({...getRepositoryInfoResponse, name: 'this pr is merged'}).resolves({status: 303, message: 'hey yo'});
            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await sut.run(fakeContext, config, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
            // then no labels should be added or removed
            expect(removeLabelStub).to.have.not.been.called;
            expect(addLabelsStub).to.have.not.been.called;
        });

        test('Test with getLabel API endpoint response promise rejection, expect the check to fail', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'failure',
                output: {
                    title: 'Label for \'merged\' not found',
                    summary: 'Are you sure the \'this pr is merged\' label exists?'
                }
            }};
            // given the merged lifecycle label is configured
            let config = {
                labels: {
                    merged: 'this pr is merged'
                }
            }
            // given the pull request is merged and not already labeled as such
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.action = 'closed';
            fakeContext.payload.pull_request.merged = true;
            fakeContext.payload.pull_request.labels = [{name: 'in review'}]
            // given the getLabel function will return unsuccessful
            getLabelStub.withArgs({...getRepositoryInfoResponse, name: 'this pr is merged'}).rejects('what up');
            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await sut.run(fakeContext, config, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
            // then no labels should be added or removed
            expect(removeLabelStub).to.have.not.been.called;
            expect(addLabelsStub).to.have.not.been.called;
        });

        test('Test selected lifecycle label is added to the pr, expect the check to succeed', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'success',
                output: {
                    title: 'All Done!',
                    summary: 'Pull request labeled'
                }
            }};
            // given the merged and reviewStarted lifecycle label is configured
            let config = {
                labels: {
                    merged: 'this pr is merged',
                    reviewStarted: 'in review'
                }
            }
            // given the pull request is merged and not already labeled as such
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.action = 'closed';
            fakeContext.payload.pull_request.merged = true;
            fakeContext.payload.pull_request.labels = [{name: 'in review'}, {name: 'unrelated label'}]
            // given the getLabel function will resolved to code 200 indicating the label exists
            getLabelStub.withArgs({...getRepositoryInfoResponse, name: 'this pr is merged'}).resolves({status: 200});
            // given the removeLabel function will succeed
            removeLabelStub.resolves({status: 200});
            // given the addLabels function will succeed
            addLabelsStub.resolves({status: 200});
            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await sut.run(fakeContext, config, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
            // then the existing 'in review' label should be removed
            expect(removeLabelStub).to.have.been.calledOnceWith({ ...getRepositoryInfoResponse, issue_number: fakePRNumber, name: 'in review'});
            // then the 'this pr is merged' label should be added
            expect(addLabelsStub).to.have.been.calledOnceWith({...getRepositoryInfoResponse, issue_number: fakePRNumber, labels: ['this pr is merged']});
        });

        test('Test with addLabels API endpoint response not successful, expect the check to fail', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'failure',
                output: {
                    title: 'Failed to add the label',
                    summary: 'This might be an internal time out, please try again'
                }
            }};
            // given the merged and reviewStarted lifecycle label is configured
            let config = {
                labels: {
                    merged: 'this pr is merged',
                    reviewStarted: 'in review'
                }
            }
            // given the pull request is merged and not already labeled as such
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.action = 'closed';
            fakeContext.payload.pull_request.merged = true;
            fakeContext.payload.pull_request.labels = [{name: 'in review'}, {name: 'unrelated label'}]
            // given the getLabel function will resolved to code 200 indicating the label exists
            getLabelStub.withArgs({...getRepositoryInfoResponse, name: 'this pr is merged'}).resolves({status: 200});
            // given the removeLabel function will succeed
            removeLabelStub.resolves({status: 200});
            // given the addLabels function will fail for an internal error (500)
            addLabelsStub.resolves({status: 300, message: 'who where what'});
            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await sut.run(fakeContext, config, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
            // then the existing 'in review' label should be removed
            expect(removeLabelStub).to.have.been.calledOnceWith({ ...getRepositoryInfoResponse, issue_number: fakePRNumber, name: 'in review'});
            // then the 'this pr is merged' label should be attempted to add
            expect(addLabelsStub).to.have.been.calledOnceWith({...getRepositoryInfoResponse, issue_number: fakePRNumber, labels: ['this pr is merged']});
        });

        test('Test with addLabels API endpoint response promise rejection, expect the check to fail', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'failure',
                output: {
                    title: 'Failed to add the label',
                    summary: 'This might be a permissions issue'
                }
            }};
            // given the merged and reviewStarted lifecycle label is configured
            let config = {
                labels: {
                    merged: 'this pr is merged',
                    reviewStarted: 'in review'
                }
            }
            // given the pull request is merged and not already labeled as such
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.action = 'closed';
            fakeContext.payload.pull_request.merged = true;
            fakeContext.payload.pull_request.labels = [{name: 'in review'}, {name: 'unrelated label'}]
            // given the getLabel function will resolved to code 200 indicating the label exists
            getLabelStub.withArgs({...getRepositoryInfoResponse, name: 'this pr is merged'}).resolves({status: 200});
            // given the removeLabel function will succeed
            removeLabelStub.resolves({status: 200});
            // given the addLabels function will fail for an internal error (500)
            addLabelsStub.rejects('drowning now');
            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await sut.run(fakeContext, config, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
            // then the existing 'in review' label should be removed
            expect(removeLabelStub).to.have.been.calledOnceWith({ ...getRepositoryInfoResponse, issue_number: fakePRNumber, name: 'in review'});
            // then the 'this pr is merged' label should be attempted to add
            expect(addLabelsStub).to.have.been.calledOnceWith({...getRepositoryInfoResponse, issue_number: fakePRNumber, labels: ['this pr is merged']});
        });

        test('Test a pr with no reviews, expect the reviewRequired label to be added to the pr', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'success',
                output: {
                    title: 'All Done!',
                    summary: 'Pull request labeled'
                }
            }};
            // given the merged and reviewStarted lifecycle label is configured
            let config = {
                labels: {
                    reviewRequired: 'waiting 4 review'
                }
            }
            // given a pull request is opened
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.action = 'opened';
            // given the getLabel function will resolved to code 200 indicating the label exists
            getLabelStub.withArgs({...getRepositoryInfoResponse, name: 'waiting 4 review'}).resolves({status: 200});
            // given the addLabels function will succeed
            addLabelsStub.resolves({status: 200});
            // given the listReviews function will return an empty list of reviews
            listReviewStub.withArgs({...getPullRequestInfoResponse}).resolves({status: 200, data: []})
            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await sut.run(fakeContext, config, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
            // then the add labels should have been called once
            expect(addLabelsStub).to.have.been.calledOnce;
            // then no label should be removed
            expect(removeLabelStub).to.have.not.been.called;
            // then the 'waiting 4 review' label should be added
            expect(addLabelsStub).to.have.been.calledOnceWith({...getRepositoryInfoResponse, issue_number: fakePRNumber, labels: ['waiting 4 review']});
        });

        test('Test with listReviews API endpoint response not successful, expect the reviewRequired label to be added to the pr', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'success',
                output: {
                    title: 'All Done!',
                    summary: 'Pull request labeled'
                }
            }};
            // given the merged and reviewStarted lifecycle label is configured
            let config = {
                labels: {
                    reviewRequired: 'waiting 4 review'
                }
            }
            // given a pull request is opened
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.action = 'opened';
            // given the getLabel function will resolved to code 200 indicating the label exists
            getLabelStub.withArgs({...getRepositoryInfoResponse, name: 'waiting 4 review'}).resolves({status: 200});
            // given the addLabels function will succeed
            addLabelsStub.resolves({status: 200});
            // given the listReviews function will return faulty response
            listReviewStub.withArgs({...getPullRequestInfoResponse}).resolves({status: 300, message: 'sup with that'})
            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await sut.run(fakeContext, config, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
            // then the add labels should have been called once
            expect(addLabelsStub).to.have.been.calledOnce;
            // then no label should be removed
            expect(removeLabelStub).to.have.not.been.called;
            // then the 'waiting 4 review' label should be added
            expect(addLabelsStub).to.have.been.calledOnceWith({...getRepositoryInfoResponse, issue_number: fakePRNumber, labels: ['waiting 4 review']});
        });

        test('Test with listReviews API endpoint response promise rejection, expect the reviewRequired label to be added to the pr', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'success',
                output: {
                    title: 'All Done!',
                    summary: 'Pull request labeled'
                }
            }};
            // given the merged and reviewStarted lifecycle label is configured
            let config = {
                labels: {
                    reviewRequired: 'waiting 4 review'
                }
            }
            // given a pull request is opened
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.action = 'opened';
            // given the getLabel function will resolved to code 200 indicating the label exists
            getLabelStub.withArgs({...getRepositoryInfoResponse, name: 'waiting 4 review'}).resolves({status: 200});
            // given the addLabels function will succeed
            addLabelsStub.resolves({status: 200});
            // given the listReviews function will be rejected
            listReviewStub.withArgs({...getPullRequestInfoResponse}).rejects('let go');
            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await sut.run(fakeContext, config, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
            // then the add labels should have been called once
            expect(addLabelsStub).to.have.been.calledOnce;
            // then no label should be removed
            expect(removeLabelStub).to.have.not.been.called;
            // then the 'waiting 4 review' label should be added
            expect(addLabelsStub).to.have.been.calledOnceWith({...getRepositoryInfoResponse, issue_number: fakePRNumber, labels: ['waiting 4 review']});
        });

        test('Test a pr with change requests, expect the changesRequested label to be added to the pr', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'success',
                output: {
                    title: 'All Done!',
                    summary: 'Pull request labeled'
                }
            }};
            // given the merged and reviewStarted lifecycle label is configured
            let config = {
                labels: {
                    changesRequested: 'changes were requested'
                }
            };
            // given a pull request is opened
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.action = 'opened';
            // given the getLabel function will resolved to code 200 indicating the label exists
            getLabelStub.withArgs({...getRepositoryInfoResponse, name: 'changes were requested'}).resolves({status: 200});
            // given the addLabels function will succeed for the following argument
            addLabelsStub.resolves({status: 200});
            // given the listReviews function will return an empty list of 1 changes requesting review
            listReviewStub.withArgs({...getPullRequestInfoResponse}).resolves({status: 200, data: [{
                state: 'CHANGES_REQUESTED',
                commit_id: fakeHeadSha,
                user: {login: fakeReviewer1}}]
            });
            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await sut.run(fakeContext, config, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
            // then no label should be removed
            expect(removeLabelStub).to.have.not.been.called;
            // then the 'changes were requested' label should be added
            expect(addLabelsStub).to.have.been.calledOnceWith({...getRepositoryInfoResponse, issue_number: fakePRNumber, labels: ['changes were requested']});
        });

        test('Test a pr with reviews but no change requests or approvals, expect the reviewStarted label to be added to the pr', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'success',
                output: {
                    title: 'All Done!',
                    summary: 'Pull request labeled'
                }
            }};
            // given the merged and reviewStarted lifecycle label is configured
            let config = {
                labels: {
                    reviewStarted: 'review has started'
                }
            }
            // given a pull request is opened
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.action = 'opened';
            // given the getLabel function will resolved to code 200 indicating the label exists
            getLabelStub.withArgs({...getRepositoryInfoResponse, name: 'review has started'}).resolves({status: 200});
            // given the addLabels function will succeed for the following argument
            addLabelsStub.resolves({status: 200});
            // given the listReviews function will return an empty list 2 commenting reviews
            listReviewStub.withArgs({...getPullRequestInfoResponse}).resolves({status: 200, data: [
                {
                    state: 'COMMENTED',
                    commit_id: fakeHeadSha,
                    user: {login: fakeReviewer1}
                },
                {
                    state: 'COMMENTED',
                    commit_id: fakeHeadSha,
                    user: {login: fakeReviewer1}
                }
            ]});
            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await sut.run(fakeContext, config, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
            // then no label should be removed
            expect(removeLabelStub).to.have.not.been.called;
            // then the 'review has started' label should be added
            expect(addLabelsStub).to.have.been.calledOnceWith({...getRepositoryInfoResponse, issue_number: fakePRNumber, labels: ['review has started']});
        });

        test('Test an approved pr with enough approvals, expect the approved label to be added to the pr', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'success',
                output: {
                    title: 'All Done!',
                    summary: 'Pull request labeled'
                }
            }};
            // given the merged and reviewStarted lifecycle label is configured
            let config = {
                labels: {
                    approved: 'this pr is approved'
                }
            }
            // given a pull request is opened
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.action = 'opened';
            // given the getLabel function will resolved to code 200 indicating the label exists
            getLabelStub.withArgs({...getRepositoryInfoResponse, name: 'this pr is approved'}).resolves({status: 200});
            // given the addLabels function will succeed for the following argument
            addLabelsStub.resolves({status: 200});
            // given the listReviews function will return an empty list of 2 approving reviews from 2 different users
            listReviewStub.withArgs({...getPullRequestInfoResponse}).resolves({status: 200, data: [
                {
                    state: 'APPROVED',
                    commit_id: fakeHeadSha,
                    user: {login: fakeReviewer1}
                },
                {
                    state: 'APPROVED',
                    commit_id: fakeHeadSha,
                    user: {login: fakeReviewer2}
                }
            ]});
            // given the branch protection is configured to require 2 approvals
            branchProtectFuncStub.withArgs({...getRepositoryInfoResponse, branch: fakeBaseRef}).resolves({
                status: 200,
                data: {
                    required_pull_request_reviews: {
                        required_approving_review_count: 2
                    }
                }
            });
            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await sut.run(fakeContext, config, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
            // then no label should be removed
            expect(removeLabelStub).to.have.not.been.called;
            // then the 'this pr is approved' label should be added
            expect(addLabelsStub).to.have.been.calledOnceWith({...getRepositoryInfoResponse, issue_number: fakePRNumber, labels: ['this pr is approved']});
        });

        test('Test an approved pr with less then enough approvals, expect the moreReviewsRequired label to be added to the pr', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'success',
                output: {
                    title: 'All Done!',
                    summary: 'Pull request labeled'
                }
            }};
            // given the merged and reviewStarted lifecycle label is configured
            let config = {
                labels: {
                    moreReviewsRequired: 'we need more approvals'
                }
            }
            // given a pull request is opened
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.action = 'opened';
            // given the getLabel function will resolved to code 200 indicating the label exists
            getLabelStub.withArgs({...getRepositoryInfoResponse, name: 'we need more approvals'}).resolves({status: 200});
            // given the addLabels function will succeed for the following argument
            addLabelsStub.resolves({status: 200});
            // given the listReviews function will return an empty list of 1 approving review
            listReviewStub.withArgs({...getPullRequestInfoResponse}).resolves({status: 200, data: [{
                state: 'APPROVED',
                commit_id: fakeHeadSha,
                user: {login: fakeReviewer1}
            }]});
            // given the branch protection is configured to require 2 approvals
            branchProtectFuncStub.withArgs({...getRepositoryInfoResponse, branch: fakeBaseRef}).resolves({
                status: 200,
                data: {
                    required_pull_request_reviews: {
                        required_approving_review_count: 2
                    }
                }
            });
            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await sut.run(fakeContext, config, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
            // then no label should be removed
            expect(removeLabelStub).to.have.not.been.called;
            // then the 'we need more approvals' label should be added
            expect(addLabelsStub).to.have.been.calledOnceWith({...getRepositoryInfoResponse, issue_number: fakePRNumber, labels: ['we need more approvals']});
        });

        test('Test with getBranchProtection API endpoint response not successful, expect the approved label to be added to the pr', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'success',
                output: {
                    title: 'All Done!',
                    summary: 'Pull request labeled'
                }
            }};
            // given the merged and reviewStarted lifecycle label is configured
            let config = {
                labels: {
                    approved: 'this pr is approved'
                }
            }
            // given a pull request is opened
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.action = 'opened';
            // given the getLabel function will resolved to code 200 indicating the label exists
            getLabelStub.withArgs({...getRepositoryInfoResponse, name: 'this pr is approved'}).resolves({status: 200});
            // given the addLabels function will succeed for the following argument
            addLabelsStub.resolves({status: 200});
            // given the listReviews function will return an empty list of 1 approving review
            listReviewStub.withArgs({...getPullRequestInfoResponse}).resolves({status: 200, data: [{
                state: 'APPROVED',
                commit_id: fakeHeadSha,
                user: {login: fakeReviewer1}
            }]});
            // given the getBranchProtection function will return unsuccessful
            branchProtectFuncStub.withArgs({...getRepositoryInfoResponse, branch: fakeBaseRef}).resolves({status: 300, message: 'ok ok ok'});
            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await sut.run(fakeContext, config, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
            // then no label should be removed
            expect(removeLabelStub).to.have.not.been.called;
            // then the 'we need more approvals' label should be added
            expect(addLabelsStub).to.have.been.calledOnceWith({...getRepositoryInfoResponse, issue_number: fakePRNumber, labels: ['this pr is approved']});
        });

        test('Test with getBranchProtection API endpoint response promise rejection, expect the approved label to be added to the pr', async () => {
            // expected check update request parts
            let expectedUpdateCheck = { ...baseExpectedUpdateCheck, ...{
                conclusion: 'success',
                output: {
                    title: 'All Done!',
                    summary: 'Pull request labeled'
                }
            }};
            // given the merged and reviewStarted lifecycle label is configured
            let config = {
                labels: {
                    approved: 'this pr is approved'
                }
            }
            // given a pull request is opened
            let fakeContext = { ...baseFakeContext }
            fakeContext.payload.action = 'opened';
            // given the getLabel function will resolved to code 200 indicating the label exists
            getLabelStub.withArgs({...getRepositoryInfoResponse, name: 'this pr is approved'}).resolves({status: 200});
            // given the addLabels function will succeed for the following argument
            addLabelsStub.resolves({status: 200});
            // given the listReviews function will return an empty list with 1 approving review
            listReviewStub.withArgs({...getPullRequestInfoResponse}).resolves({status: 200, data: [{
                state: 'APPROVED',
                commit_id: fakeHeadSha,
                user: {login: fakeReviewer1}
            }]});
            // given the getBranchProtection function will be rejected
            branchProtectFuncStub.withArgs({...getRepositoryInfoResponse, branch: fakeBaseRef}).rejects('get out of here');
            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await sut.run(fakeContext, config, new Date().toISOString());
            // then verify a check run to be created and updated as expected
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
            // then no label should be removed
            expect(removeLabelStub).to.have.not.been.called;
            // then the 'we need more approvals' label should be added
            expect(addLabelsStub).to.have.been.calledOnceWith({...getRepositoryInfoResponse, issue_number: fakePRNumber, labels: ['this pr is approved']});
        });
    });
});
