const chai = require('chai');
const emailVerifier = require('@digitalroute/email-verify');
const rewire = require('rewire');
const sinon = require('sinon');
const { beforeEach } = require('mocha');
const { cloneDeep } = require('lodash');
const { EOL } = require('os');

chai.use(require('sinon-chai'));

const prSignedCommitsHandler = rewire('../../src/handlers/pr-signed-commits');
const expect = chai.expect;

suite('Testing the pr-signed-commits handler', () => {
    /* ######################### ##
    ## #### Shared Fixtures #### ##
    ## ######################### */
    const fakeSha = '#f54dda543@';
    const fakeCheckId = 13;
    const fakePRNumber = 66;
    const fakeCommitUrl = `https://fake.commit.url/${fakeSha}`;
    const fakeAuthorName = 'Elias Author';
    const fakeAuthorEmail = 'elias.author@fake.mail';
    const fakeCommitterName = 'Ezekiel Committer';
    const fakeCommitterEmail = 'ezekiel.committer@fake.mail';
    // fake unknown fixture data
    const fakeUnknownName = 'Some Other';
    const fakeUnknownEmail = 'some.other@email.address';
    // fake bot fixture data
    const fakeBotName = 'dependabot[bot]';
    const fakeBotEmail = '49699333+dependabot[bot]@users.noreply.github.com';

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
    // the common base for all testing commit objects
    const base_commitObject = {
        html_url: fakeCommitUrl,
        commit: {
            message: '',
            author: {
                name: fakeAuthorName,
                email: fakeAuthorEmail
            },
            committer: {
                name: fakeCommitterName,
                email: fakeCommitterEmail
            }

        }
    }
    // the common base for all expected update check run requests
    const base_expectedUpdateCheck = {
        check_run_id: fakeCheckId,
        name: sinon.match.string,
        details_url: sinon.match(u => new URL(u)),
        started_at: sinon.match(t => Date.parse(t)),
        status: 'completed',
        conclusion: '',
        completed_at: sinon.match(t => Date.parse(t)),
        output: {}
    }

    /* ###################### ##
    ## #### Fake Commits #### ##
    ## ###################### */
    var commitSignedByAuthor = cloneDeep(base_commitObject);
    commitSignedByAuthor.commit.message =
        `this is a commit signed by the author${EOL}${EOL}Signed-off-by: ${fakeAuthorName} <${fakeAuthorEmail}>`;

    var commitSignedByCommitter = cloneDeep(base_commitObject);
    commitSignedByCommitter.commit.message =
        `this is a commit signed by the committer${EOL}${EOL}Signed-off-by: ${fakeCommitterName} <${fakeCommitterEmail}>`;

    var commitSignedByUnknown = cloneDeep(base_commitObject);
    commitSignedByUnknown.commit.message =
        `this is a commit signed by the unknown${EOL}${EOL}Signed-off-by: ${fakeUnknownName} <${fakeUnknownEmail}>`;

    var commitUnsigned = cloneDeep(base_commitObject);
    commitUnsigned.commit.message = 'this commit is not signed';

    var commitUnsignedBot = cloneDeep(base_commitObject);
    commitUnsignedBot.commit.author.name = fakeBotName;
    commitUnsignedBot.commit.author.email = fakeBotEmail;
    commitUnsignedBot.commit.committer.name = fakeBotName;
    commitUnsignedBot.commit.committer.email = fakeBotEmail;
    commitUnsignedBot.commit.message = 'this commit is not signed';

    /* ###################################################### ##
    ## #### Fixtures and test cases for successful tests #### ##
    ## ####################################################### */
    const success_expectedUpdateCheck = cloneDeep(base_expectedUpdateCheck);
    success_expectedUpdateCheck.conclusion = 'success';
    success_expectedUpdateCheck.output = {
        title: 'Well Done!',
        summary: 'All commits are signed'
    };

    const oneSignedByAuthor_commitsListResponse = {data: [commitSignedByAuthor]};
    const oneSignedByCommitter_commitsListResponse = {data: [commitSignedByCommitter]};
    const twoSignedCommitsByAuthor_commitsListResponse = {data: [commitSignedByAuthor, commitSignedByAuthor]};
    const twoCommitsBotNotSignedAuthorSigned_commitsListResponse = {data: [commitUnsignedBot, commitSignedByAuthor]};

    const successTestCases = [
        {
            testTitle: 'Test with one commit signed by the author',
            signedEmail: fakeAuthorEmail,
            stubCommitsList: oneSignedByAuthor_commitsListResponse,
        },
        {
            testTitle: 'Test with one commit signed by the committer',
            signedEmail: fakeCommitterEmail,
            stubCommitsList: oneSignedByCommitter_commitsListResponse,
        },
        {
            testTitle: 'Test with two commits signed by the author',
            signedEmail: fakeAuthorEmail,
            stubCommitsList: twoSignedCommitsByAuthor_commitsListResponse,
        },
    ];

    /* ################################################### ##
    ## #### Fixtures and test cases for failure tests #### ##
    ## #################################################### */
    const failure_expectedUpdateCheck = cloneDeep(base_expectedUpdateCheck);
    failure_expectedUpdateCheck.conclusion = 'failure';
    failure_expectedUpdateCheck.output = {
        title: 'Found 1 unsigned commits',
        summary: 'We need to get the these commits signed',
        text: `- ${fakeCommitUrl}`
    };

    const oneSignedByUnknown_commitsListResponse = {data: [commitSignedByUnknown]};
    const oneUnsigned_commitsListResponse = {data: [commitUnsigned]};
    const oneUnsignedAndOneSignedByAuthor_commitsListResponse = {data: [commitUnsigned, commitSignedByAuthor]};

    const failureTestCases = [
        {
            testTitle: 'Test with one commit signed by someone else (not author/committer)',
            stubCommitsList: oneSignedByUnknown_commitsListResponse,
        },
        {
            testTitle: 'Test with one unsigned commit',
            stubCommitsList: oneUnsigned_commitsListResponse,
        }
    ];

    const serviceErrorTestCases = [
        {
            name: 'SMTPConnectionError',
            code: emailVerifier.verifyCodes.SMTPConnectionError
        },
        {
            name: 'SMTPConnectionTimeout',
            code: emailVerifier.verifyCodes.SMTPConnectionTimeout
        },
        {
            name: 'domainNotFound',
            code: emailVerifier.verifyCodes.domainNotFound
        },
        {
            name: 'invalidEmailStructure',
            code: emailVerifier.verifyCodes.invalidEmailStructure
        },
        {
            name: 'noMxRecords',
            code: emailVerifier.verifyCodes.noMxRecords
        },
    ];

    const emailIgnoreConf = { ignore :{ emails:  [fakeAuthorEmail] }};
    const userIgnoreConf = { ignore :{ users:  [fakeAuthorName] }};
    const ignoreUserAndMailTest = [
        {
            name: 'email',
            conf: emailIgnoreConf
        },
        {
            name: 'user name',
            conf: userIgnoreConf
        }
    ]

    /* ######################### ##
    ## #### Stubs and Fakes #### ##
    ## ######################### */
    let verifyEmailStub;
    let createCheckStub;
    let repoFuncStub;
    let pullRequestFuncStub;
    let listCommitsStub;
    let updateCheckStub;

    let fakeContext = {};

    beforeEach(() => {
        // unwrap any previous wrapped sinon objects
        sinon.restore();
        // create stubs for the context and imported functions
        verifyEmailStub = sinon.stub();
        createCheckStub = sinon.stub();
        repoFuncStub = sinon.stub();
        pullRequestFuncStub = sinon.stub();
        listCommitsStub = sinon.stub();
        updateCheckStub = sinon.stub();
        /* ###################### ##
        ## #### Fake Context #### ##
        ## ###################### */
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

        /* ######################################## ##
        ## #### Shared Stubbing and injections #### ##
        ## ######################################## */
        // inject the handler with a fake stubbed email verify tool
        let emailVerifierFake = sinon.fake();
        emailVerifierFake.verify = verifyEmailStub;
        emailVerifierFake.verifyCodes = emailVerifier.verifyCodes;
        prSignedCommitsHandler.__set__('emailVerifier', emailVerifierFake);

        // given the repo function will loop back the first argument it gets
        repoFuncStub.returnsArg(0);
        // given the pullRequest function return the list commits arg
        pullRequestFuncStub.returns(expectedListCommitsInfo);
        // given the create check function will resolve to the fake response
        createCheckStub.resolves(createCheckResponse);
    });

    /* ############### ##
    ## #### Tests #### ##
    ## ############### */
    successTestCases.forEach(testCase => {
        test(`${testCase.testTitle}, expect a successful check run`, async () => {
            verifyEmailStub
                .withArgs(testCase.signedEmail, sinon.match.func)
                .yields(null, { code: emailVerifier.verifyCodes.finishedVerification });

            // given the list commits service will resolve to the stubbed response
            listCommitsStub.resolves(testCase.stubCommitsList);

            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await prSignedCommitsHandler.run(fakeContext, sinon.fake(), new Date().toISOString());

            // then expect the following functions invocation flow
            expect(repoFuncStub).to.have.calledWith(expectedCreateCheckRunInfo);
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);

            expect(pullRequestFuncStub).to.have.been.calledOnceWith();
            expect(listCommitsStub).to.have.been.calledOnceWith(expectedListCommitsInfo);

            expect(repoFuncStub).to.have.calledWith(success_expectedUpdateCheck);
            expect(updateCheckStub).to.have.been.calledOnceWith(success_expectedUpdateCheck);
        })
    });

    failureTestCases.forEach(testCase => {
        test(`${testCase.testTitle}, expect a failed check run`, async () => {
            // given the list commits service will resolve to the stubbed response
            listCommitsStub.resolves(testCase.stubCommitsList);

            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await prSignedCommitsHandler.run(fakeContext, sinon.fake(), new Date().toISOString());

            // then expect the following functions invocation flow
            expect(repoFuncStub).to.have.calledWith(expectedCreateCheckRunInfo);
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);

            expect(pullRequestFuncStub).to.have.been.calledOnceWith();
            expect(listCommitsStub).to.have.been.calledOnceWith(expectedListCommitsInfo);

            expect(repoFuncStub).to.have.calledWith(failure_expectedUpdateCheck);
            expect(updateCheckStub).to.have.been.calledOnceWith(failure_expectedUpdateCheck);

            expect(verifyEmailStub).to.have.not.been.called;
        })
    });

    test('Test with two commits, one unsigned and one signed by the author, expect a failed check run', async () => {
        verifyEmailStub
            .withArgs(fakeAuthorEmail, sinon.match.func)
            .yields(null, { code: emailVerifier.verifyCodes.finishedVerification });

        // given the list commits service will resolve to the stubbed response
        listCommitsStub.resolves(oneUnsignedAndOneSignedByAuthor_commitsListResponse);

        // when invoking the handler with the fake context, a fake config, and a iso timestamp
        await prSignedCommitsHandler.run(fakeContext, sinon.fake(), new Date().toISOString());

        // then expect the following functions invocation flow
        expect(repoFuncStub).to.have.calledWith(expectedCreateCheckRunInfo);
        expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);

        expect(pullRequestFuncStub).to.have.been.calledOnceWith();
        expect(listCommitsStub).to.have.been.calledOnceWith(expectedListCommitsInfo);

        expect(repoFuncStub).to.have.calledWith(failure_expectedUpdateCheck);
        expect(updateCheckStub).to.have.been.calledOnceWith(failure_expectedUpdateCheck);
    })

    serviceErrorTestCases.forEach(testCase => {
        test(`Test with one commit signed by the author, with a ${testCase.name} service error, expect a failed check run`, async () => {
            verifyEmailStub
                .withArgs(fakeAuthorEmail, sinon.match.func)
                .yields(null, { code: testCase.code });

            // given the list commits service will resolve to the stubbed response
            listCommitsStub.resolves(oneSignedByAuthor_commitsListResponse);

            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await prSignedCommitsHandler.run(fakeContext, sinon.fake(), new Date().toISOString());

            // then expect the following functions invocation flow
            expect(repoFuncStub).to.have.calledWith(expectedCreateCheckRunInfo);
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);

            expect(pullRequestFuncStub).to.have.been.calledOnceWith();
            expect(listCommitsStub).to.have.been.calledOnceWith(expectedListCommitsInfo);

            expect(repoFuncStub).to.have.calledWith(failure_expectedUpdateCheck);
            expect(updateCheckStub).to.have.been.calledOnceWith(failure_expectedUpdateCheck);
        })
    });

    test('Test with one commit signed by a Bot, not author or committer, expect a successful check run', async () => {
        verifyEmailStub
            .withArgs(fakeBotEmail, sinon.match.func)
            .yields(null, { code: emailVerifier.verifyCodes.finishedVerification });

        // given the list commits service will resolve to one commit signed by an unknown user
        listCommitsStub.resolves({data: [commitUnsignedBot]});

        // given the payload has identified the unknown user as a bot
        let fakeBotContext = cloneDeep(fakeContext);

        // when invoking the handler with the fake context, a fake config, and a iso timestamp
        await prSignedCommitsHandler.run(fakeBotContext, sinon.fake(), new Date().toISOString());

        // then expect the following functions invocation flow
        expect(repoFuncStub).to.have.calledWith(expectedCreateCheckRunInfo);
        expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);

        expect(pullRequestFuncStub).to.have.been.calledOnceWith();
        expect(listCommitsStub).to.have.been.calledOnceWith(expectedListCommitsInfo);

        expect(repoFuncStub).to.have.calledWith(success_expectedUpdateCheck);
        expect(updateCheckStub).to.have.been.calledOnceWith(success_expectedUpdateCheck);
    })

    test('Test with two commits, one is unsigned by bot, and one signed by author', async () => {
        verifyEmailStub
            .withArgs(fakeBotEmail, sinon.match.func)
            .yields(null, { code: emailVerifier.verifyCodes.finishedVerification });

        // given the list commits service will resolve to one commit signed by an unknown user
        listCommitsStub.resolves(twoCommitsBotNotSignedAuthorSigned_commitsListResponse);

        // given the payload has identified the unknown user as a bot
        let fakeBotContext = cloneDeep(fakeContext);

        // when invoking the handler with the fake context, a fake config, and a iso timestamp
        await prSignedCommitsHandler.run(fakeBotContext, sinon.fake(), new Date().toISOString());

        // then expect the following functions invocation flow
        expect(repoFuncStub).to.have.calledWith(expectedCreateCheckRunInfo);
        expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);

        expect(pullRequestFuncStub).to.have.been.calledOnceWith();
        expect(listCommitsStub).to.have.been.calledOnceWith(expectedListCommitsInfo);

        expect(repoFuncStub).to.have.calledWith(success_expectedUpdateCheck);
        expect(updateCheckStub).to.have.been.calledOnceWith(success_expectedUpdateCheck);
    })

    ignoreUserAndMailTest.forEach( testCase => {
        test(`Test ${testCase.name} is ignored`, async () => {
            verifyEmailStub
                .withArgs(fakeBotEmail, sinon.match.func)
                .yields(null, { code: emailVerifier.verifyCodes.finishedVerification });

            // given the list commits service will resolve to one commit signed by an unknown user
            listCommitsStub.resolves(oneSignedByAuthor_commitsListResponse);

            // when invoking the handler with the fake context, a fake config, and a iso timestamp
            await prSignedCommitsHandler.run(fakeContext, testCase.conf, new Date().toISOString());

            // then expect the following functions invocation flow
            expect(repoFuncStub).to.have.calledWith(expectedCreateCheckRunInfo);
            expect(createCheckStub).to.have.been.calledOnceWith(expectedCreateCheckRunInfo);

            expect(pullRequestFuncStub).to.have.been.calledOnceWith();
            expect(listCommitsStub).to.have.been.calledOnceWith(expectedListCommitsInfo);

            expect(repoFuncStub).to.have.calledWith(success_expectedUpdateCheck);
            expect(updateCheckStub).to.have.been.calledOnceWith(success_expectedUpdateCheck);
        })
    });
});
