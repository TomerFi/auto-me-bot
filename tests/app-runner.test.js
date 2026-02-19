import { expect } from 'chai'
import { createHmac, generateKeyPairSync, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, 'fixtures');

// generate a test RSA key pair (probot requires a valid private key)
const { privateKey: testPrivateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

const TEST_APP_ID = '12345';
const TEST_WEBHOOK_SECRET = 'test-webhook-secret';
const TEST_PRIVATE_KEY_B64 = Buffer.from(testPrivateKey).toString('base64');

// build a mock Express-like request object from a fixture file
function buildReq(fixtureFile, eventName) {
    const payload = readFileSync(resolve(fixturesDir, fixtureFile), 'utf-8');
    const parsed = JSON.parse(payload);
    if (!eventName) {
        const base = fixtureFile.replace('.json', '');
        eventName = parsed.action ? base.slice(0, base.lastIndexOf('.')) : base;
    }
    const body = JSON.stringify(parsed);
    const signature = 'sha256=' + createHmac('sha256', TEST_WEBHOOK_SECRET)
        .update(body).digest('hex');

    return {
        headers: {
            'x-github-delivery': randomUUID(),
            'x-github-event': eventName,
            'x-hub-signature-256': signature,
        },
        rawBody: Buffer.from(body),
    };
}

// build a mock Express-like response object that captures status and body
function buildRes() {
    const res = { statusCode: null, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.send = (msg) => { res.body = msg; return res; };
    return res;
}

suite('Testing the app-runner handler', () => {
    let originalEnv;

    suiteSetup(() => {
        // save and override env vars needed by the handler
        originalEnv = { ...process.env };
        process.env.APP_ID = TEST_APP_ID;
        process.env.WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
        process.env.PRIVATE_KEY = TEST_PRIVATE_KEY_B64;
        process.env.LOG_LEVEL = 'fatal'; // suppress logs during tests
    });

    suiteTeardown(() => {
        // restore original env
        process.env = originalEnv;
    });

    test('Handler initializes probot and processes a ping event', async () => {
        const { handler } = await import('../src/app-runner.js');
        const req = buildReq('ping.json', 'ping');
        const res = buildRes();
        await handler(req, res);
        expect(res.statusCode).to.equal(200);
    });

    test('Handler initializes probot and accepts a pull_request event', async () => {
        const { handler } = await import('../src/app-runner.js');
        const req = buildReq('pull_request.opened.json');
        const res = buildRes();
        // handlers will attempt GitHub API calls which will fail, but
        // verifyAndReceive should not reject -- errors are handled by onError
        await handler(req, res);
        expect(res.statusCode).to.equal(200);
    });

    test('Handler returns 500 with an invalid webhook signature', async () => {
        const { handler } = await import('../src/app-runner.js');
        const req = buildReq('ping.json', 'ping');
        const res = buildRes();
        req.headers['x-hub-signature-256'] = 'sha256=invalid';
        await handler(req, res);
        expect(res.statusCode).to.equal(500);
    });
});
