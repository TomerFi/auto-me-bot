const beforeEach = require('mocha').beforeEach;
const chai = require('chai');
const sinon = require('sinon');

chai.use(require('sinon-chai'));

const prLifecycleLabelsHandler = require('../../src/handlers/pr-lifecycle-labels');
const expect = chai.expect;

suite('Testing the pr-lifecycle-labels', () => {
    const fakeBaseSha = '#t65ujj453%';
    const fakeHeadSha = '#f54dda543@';
    const fakeCheckId = 13;
    const fakePRNumber = 66;
    const fakeOwner = 'jonDoe';
    const fakeRepository = 'aProject';

    // expected objects
    let baseFakeContext = {};
    let baseExpectedUpdateCheck = {};
    let expectedCreateCheckRunInfo = {};
    let createCheckResponse = {};
    let getRepositoryInfoResponse = {};
    let getPullRequestInfoResponse = {};

    // stubs and fakes
    let createCheckStub;
    let updateCheckStub;
    let getLabelStub;
    let addLabelsStub;
    let listReviewStub;
    let branchProtectFuncStub;
    let repoFuncStub;
    let pullRequestFuncStub;

    beforeEach(() => {
        sinon.restore(); // unwrap any previous wrapped sinon objects

        createCheckStub = sinon.stub(); // stub for context.octokit.checks.create function
        updateCheckStub = sinon.stub(); // stub for context.octokit.checks.update function
        getLabelStub = sinon.stub(); // stub for context.octokit.issues.getLabel function
        addLabelsStub = sinon.stub(); // stub for context.octokit.issues.addLabels function
        listReviewStub = sinon.stub(); // stub for context.octokit.pull.listReviews
        branchProtectFuncStub = sinon.stub() // stub for context.octokit.repos.getBranchProtection function
        // create the stubbed response for creating a new check run
        createCheckResponse = {
            data: {
                id: fakeCheckId
            }
        };
        repoFuncStub = sinon.stub(); // stub for context.repo function
        getRepositoryInfoResponse = { owner: fakeOwner, repo: fakeRepository };
        repoFuncStub.callsFake((a) => {return { ...getRepositoryInfoResponse, ...a }});

        pullRequestFuncStub = sinon.stub(); //stub for context.pullRequest function
        getPullRequestInfoResponse = { ...getRepositoryInfoResponse ,pull_number: fakePRNumber };
        // given the pullRequest function return the list commits arg
        pullRequestFuncStub.callsFake((a) => {return { ...getPullRequestInfoResponse, ...a }});
        // stub the create check function will resolve to the fake response
        createCheckStub.resolves(createCheckResponse);
        // expected create check run argument
        expectedCreateCheckRunInfo = Object.freeze({
            owner: fakeOwner,
            repo: fakeRepository,
            head_sha: fakeHeadSha,
            name: sinon.match.string,
            details_url: sinon.match(u => new URL(u)),
            started_at: sinon.match(t => Date.parse(t)),
            status: 'in_progress'
        })
        // expected update check run argument (base)
        baseExpectedUpdateCheck = Object.freeze({
            owner: fakeOwner,
            repo: fakeRepository,
            check_run_id: fakeCheckId,
            name: sinon.match.string,
            details_url: sinon.match(u => new URL(u)),
            started_at: sinon.match(t => Date.parse(t)),
            status: 'completed',
            completed_at: sinon.match(t => Date.parse(t)),
        });
        // create a fake context for invoking the application with (base)
        baseFakeContext = Object.freeze({
            payload: {
                pull_request: {
                    base: {
                        sha: fakeBaseSha
                    },
                    head: {
                        sha: fakeHeadSha
                    },
                    labels: []
                }
            },
            octokit: {
                checks: {
                    create: createCheckStub,
                    update: updateCheckStub
                },
                issues: {
                    getLabel: getLabelStub,
                    addLabels: addLabelsStub
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
        await prLifecycleLabelsHandler.run(fakeContext, config, new Date().toISOString());
        // then expect the following functions invocation flow
        expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
        expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
        // then no labels should be added or removed
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
            await prLifecycleLabelsHandler.run(fakeContext, invalidConfig, new Date().toISOString());
            // then expect the following functions invocation flow
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
            expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
            // then no labels should be added or removed
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
        await prLifecycleLabelsHandler.run(fakeContext, config, new Date().toISOString());
        // then expect the following functions invocation flow
        expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
        expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
        // then no labels should be added or removed
        expect(addLabelsStub).to.have.not.been.called;
    });

    test('Test selected lifecycle label is not created on the repo, expect the check to fail', async () => {
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
        // given the getLabel function will resolved to code 404 indicating the label doesn't exists
        getLabelStub.withArgs({...getPullRequestInfoResponse, name: 'this pr is merged'}).resolves({code: 404});
        // when invoking the handler with the fake context, a fake config, and a iso timestamp
        await prLifecycleLabelsHandler.run(fakeContext, config, new Date().toISOString());
        // then expect the following functions invocation flow
        expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
        expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
        // then no labels should be added or removed
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
        getLabelStub.withArgs({...getPullRequestInfoResponse, name: 'this pr is merged'}).resolves({code: 200});
        // given the addLabels function will succeed for the following argument
        addLabelsStub.withArgs({...getPullRequestInfoResponse, names: ['this pr is merged', 'unrelated label']}).resolves({code: 200});
        // when invoking the handler with the fake context, a fake config, and a iso timestamp
        await prLifecycleLabelsHandler.run(fakeContext, config, new Date().toISOString());
        // then expect the following functions invocation flow
        expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
        expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
        // then the add labels should have been called once
        expect(addLabelsStub).to.have.been.calledOnce;
    });

    test('Test selected lifecycle label with api access fail, expect the check to fail', async () => {
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
        getLabelStub.withArgs({...getPullRequestInfoResponse, name: 'this pr is merged'}).resolves({code: 200});
        // given the addLabels function will report and internal error (500) for the following argument
        addLabelsStub.withArgs({...getPullRequestInfoResponse, names: ['this pr is merged', 'unrelated label']}).resolves({code: 500});
        // when invoking the handler with the fake context, a fake config, and a iso timestamp
        await prLifecycleLabelsHandler.run(fakeContext, config, new Date().toISOString());
        // then expect the following functions invocation flow
        expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
        expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
        // then the add labels should have been called once
        expect(addLabelsStub).to.have.been.calledOnce;
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
        getLabelStub.withArgs({...getPullRequestInfoResponse, name: 'waiting 4 review'}).resolves({code: 200});
        // given the addLabels function will succeed for the following argument
        addLabelsStub.withArgs({...getPullRequestInfoResponse, names: ['waiting 4 review']}).resolves({code: 200});
        // given the listReviews function will return an empty list of reviews
        listReviewStub.withArgs({...getPullRequestInfoResponse}).resolves({code: 200, data: []})
        // when invoking the handler with the fake context, a fake config, and a iso timestamp
        await prLifecycleLabelsHandler.run(fakeContext, config, new Date().toISOString());
        // then expect the following functions invocation flow
        expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
        expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
        // then the add labels should have been called once
        expect(addLabelsStub).to.have.been.calledOnce;
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
        }
        // given a pull request is opened
        let fakeContext = { ...baseFakeContext }
        fakeContext.payload.action = 'opened';
        // given the getLabel function will resolved to code 200 indicating the label exists
        getLabelStub.withArgs({...getPullRequestInfoResponse, name: 'changes were requested'}).resolves({code: 200});
        // given the addLabels function will succeed for the following argument
        addLabelsStub.withArgs({...getPullRequestInfoResponse, names: ['changes were requested']}).resolves({code: 200});
        // given the listReviews function will return an empty list of reviews
        listReviewStub.withArgs({...getPullRequestInfoResponse}).resolves({code: 200, data: [{state: 'CHANGES_REQUESTED'}]})
        // when invoking the handler with the fake context, a fake config, and a iso timestamp
        await prLifecycleLabelsHandler.run(fakeContext, config, new Date().toISOString());
        // then expect the following functions invocation flow
        expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
        expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
        // then the add labels should have been called once
        expect(addLabelsStub).to.have.been.calledOnce;
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
        getLabelStub.withArgs({...getPullRequestInfoResponse, name: 'review has started'}).resolves({code: 200});
        // given the addLabels function will succeed for the following argument
        addLabelsStub.withArgs({...getPullRequestInfoResponse, names: ['review has started']}).resolves({code: 200});
        // given the listReviews function will return an empty list of reviews
        listReviewStub.withArgs({...getPullRequestInfoResponse}).resolves({code: 200, data: [{state: 'NOTHING_SPECIAL'}, {state: 'MAKING_UP_STATES'}]})
        // when invoking the handler with the fake context, a fake config, and a iso timestamp
        await prLifecycleLabelsHandler.run(fakeContext, config, new Date().toISOString());
        // then expect the following functions invocation flow
        expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
        expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
        // then the add labels should have been called once
        expect(addLabelsStub).to.have.been.calledOnce;
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
        getLabelStub.withArgs({...getPullRequestInfoResponse, name: 'this pr is approved'}).resolves({code: 200});
        // given the addLabels function will succeed for the following argument
        addLabelsStub.withArgs({...getPullRequestInfoResponse, names: ['this pr is approved']}).resolves({code: 200});
        // given the listReviews function will return an empty list of reviews
        listReviewStub.withArgs({...getPullRequestInfoResponse}).resolves({code: 200, data: [{state: 'APPROVED'}, {state: 'APPROVED'}]})
        //
        branchProtectFuncStub.withArgs({...getRepositoryInfoResponse, branch: fakeBaseSha}).resolves({
            code: 200,
            data: {
                required_pull_request_reviews: {
                    required_approving_review_count: 2
                }
            }
        });
        // when invoking the handler with the fake context, a fake config, and a iso timestamp
        await prLifecycleLabelsHandler.run(fakeContext, config, new Date().toISOString());
        // then expect the following functions invocation flow
        expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
        expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
        // then the add labels should have been called once
        expect(addLabelsStub).to.have.been.calledOnce;
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
        getLabelStub.withArgs({...getPullRequestInfoResponse, name: 'we need more approvals'}).resolves({code: 200});
        // given the addLabels function will succeed for the following argument
        addLabelsStub.withArgs({...getPullRequestInfoResponse, names: ['we need more approvals']}).resolves({code: 200});
        // given the listReviews function will return an empty list of reviews
        listReviewStub.withArgs({...getPullRequestInfoResponse}).resolves({code: 200, data: [{state: 'APPROVED'}]})
        //
        branchProtectFuncStub.withArgs({...getRepositoryInfoResponse, branch: fakeBaseSha}).resolves({
            code: 200,
            data: {
                required_pull_request_reviews: {
                    required_approving_review_count: 2
                }
            }
        });
        // when invoking the handler with the fake context, a fake config, and a iso timestamp
        await prLifecycleLabelsHandler.run(fakeContext, config, new Date().toISOString());
        // then expect the following functions invocation flow
        expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);
        expect(updateCheckStub).to.have.been.calledOnceWith(expectedUpdateCheck);
        // then the add labels should have been called once
        expect(addLabelsStub).to.have.been.calledOnce;
    });
});
