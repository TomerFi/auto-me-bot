const sinon = require('sinon');
const chai = require('chai');
const beforeEach = require('mocha').beforeEach;

chai.use(require('sinon-chai'));

const enforceConventionalCommits = require('../src/handlers/enforce-conventional-commits');

const expect = chai.expect;

suite('Testing the enforce-conventional-commits handler', () => {
    const fakeSha = '#f54dda543@';
    const fakeCheckId = 13;
    const fakePRNumber = 66;
    const fakeCommitUrl = `https://fake.commit.url/${fakeSha}`;

    const goodCommitMessage = 'chore: unit test this thing';
    const errorCommitMessage = 'it doesn\'t matter what you read';
    const warningCommitMessage = `${goodCommitMessage}\r\nmissing line break`;

    let createCheckStub;
    let repoFuncStub;
    let listCommitsStub;
    let updateCheckStub;

    const createCheckFakeArg = {
        head_sha: fakeSha,
        name: sinon.match.string,
        details_url: sinon.match.any,
        started_at: sinon.match.string,
        status: 'in_progress'
    };

    const listCommitsFakeArg = {
        pull_number: fakePRNumber
    };

    const updateCheckFakeGoodCommit = {
        check_run_id: fakeCheckId,
        name: sinon.match.string,
        details_url: sinon.match.string,
        started_at: sinon.match.string,
        status: 'completed',
        conclusion: 'success',
        completed_at: sinon.match.string,
        output: {
            title: 'Good Job!',
            summary: 'Nothing to do here, no one told me you\'re a commit-message-master'
        }
    }

    const updateCheckFakeErrorCommit = {
        check_run_id: fakeCheckId,
        name: sinon.match.string,
        details_url: sinon.match.string,
        started_at: sinon.match.string,
        status: 'completed',
        conclusion: 'failure',
        completed_at: sinon.match.string,
        output: {
            title: 'Linting Failed',
            summary: 'Oops, looks like we got 1 non-conventional commit message',
            text: [
                '### https://fake.commit.url/#f54dda543@',
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

    const updateCheckFakeWarningCommit = {
        check_run_id: fakeCheckId,
        name: sinon.match.string,
        details_url: sinon.match.string,
        started_at: sinon.match.string,
        status: 'completed',
        conclusion: 'success',
        completed_at: sinon.match.string,
        output: {
            title: 'Linting Found Warnings',
            summary: 'Hmmm... we got 1 warning you might want to look at',
            text: '### https://fake.commit.url/#f54dda543@\r\n' +
                '```\r\n' +
                'chore: unit test this thing\n' +
                '\n' +
                'missing line break\r\n' +
                '```\r\n' +
                '#### Warnings\r\n' +
                '| name | level | message |\r\n' +
                '| - | - | - |\r\n' +
                '| body-leading-blank | 1 | body must have leading blank line |'
        }
    }

    const fakeCreateCheckResponse = {
        data: {
            id: fakeCheckId
        }
    };

    const fakeListCommitsWithGoodCommit = {
        data: [
            {
                html_url: fakeCommitUrl,
                commit: {
                    message: goodCommitMessage
                }
            }
        ]
    }

    const fakeListCommitsWithErrorCommit = {
        data: [
            {
                html_url: fakeCommitUrl,
                commit: {
                    message: errorCommitMessage
                }
            }
        ]
    }

    const fakeListCommitsWithWarningCommit = {
        data: [
            {
                html_url: fakeCommitUrl,
                commit: {
                    message: warningCommitMessage
                }
            }
        ]
    }

    let fakeContext = {};

    beforeEach(() => {
        sinon.restore(); // unwrap any previously wrapped sinon objects

        // create stubs
        createCheckStub = sinon.stub();
        repoFuncStub = sinon.stub();
        listCommitsStub = sinon.stub();
        updateCheckStub = sinon.stub();

        // fake context for starting the application
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
            repo: repoFuncStub
        };
    });

    beforeEach(() => {
        // given the repo function will loop back the first argument it gets
        repoFuncStub.returnsArg(0);
        // given the create check function will resolve to the fake response
        createCheckStub.resolves(fakeCreateCheckResponse);
    })

    test('Test with one good commit', async () => {
        // given the list commits function will resolve to the fake response
        listCommitsStub.resolves(fakeListCommitsWithGoodCommit);
        // when invoking the handler with the fake context
        await enforceConventionalCommits(fakeContext);
        // then expect the following functions invocation flow
        expect(repoFuncStub).to.have.calledWith(createCheckFakeArg);
        expect(createCheckStub).to.have.been.calledOnceWith(createCheckFakeArg);

        expect(repoFuncStub).to.have.calledWith(listCommitsFakeArg);
        expect(listCommitsStub).to.have.been.calledOnceWith(listCommitsFakeArg);

        expect(repoFuncStub).to.have.calledWith(updateCheckFakeGoodCommit);
        expect(updateCheckStub).to.have.been.calledOnceWith(updateCheckFakeGoodCommit);
    });

    test('Test with one bed commit the reports as an error', async () => {
        // given the list commits function will resolve to the fake response
        listCommitsStub.resolves(fakeListCommitsWithErrorCommit);
        // when invoking the handler with the fake context
        await enforceConventionalCommits(fakeContext);
        // then expect the following functions invocation flow
        expect(repoFuncStub).to.have.calledWith(createCheckFakeArg);
        expect(createCheckStub).to.have.been.calledOnceWith(createCheckFakeArg);

        expect(repoFuncStub).to.have.calledWith(listCommitsFakeArg);
        expect(listCommitsStub).to.have.been.calledOnceWith(listCommitsFakeArg);

        expect(repoFuncStub).to.have.calledWith(updateCheckFakeErrorCommit);
        expect(updateCheckStub).to.have.been.calledOnceWith(updateCheckFakeErrorCommit);
    });

    test('Test with one bed commit the reports as a warning', async () => {
        // given the list commits function will resolve to the fake response
        listCommitsStub.resolves(fakeListCommitsWithWarningCommit);
        // when invoking the handler with the fake context
        await enforceConventionalCommits(fakeContext);
        // then expect the following functions invocation flow
        expect(repoFuncStub).to.have.calledWith(createCheckFakeArg);
        expect(createCheckStub).to.have.been.calledOnceWith(createCheckFakeArg);

        expect(repoFuncStub).to.have.calledWith(listCommitsFakeArg);
        expect(listCommitsStub).to.have.been.calledOnceWith(listCommitsFakeArg);

        expect(repoFuncStub).to.have.calledWith(updateCheckFakeWarningCommit);
        expect(updateCheckStub).to.have.been.calledOnceWith(updateCheckFakeWarningCommit);
    });
});
