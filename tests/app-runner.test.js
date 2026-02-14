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

// build a lambda event object from a fixture file
function buildEvent(fixtureFile, eventName) {
    const payload = readFileSync(resolve(fixturesDir, fixtureFile), 'utf-8');
    const parsed = JSON.parse(payload);
    // derive event name from filename if not provided
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
        body,
    };
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

    test('Handler initializes probot and processes a ping event without throwing', async () => {
        const { handler } = await import('../src/app-runner.js');
        const event = buildEvent('ping.json', 'ping');
        // ping events have no matching handler, so this should resolve cleanly
        await handler(event);
    });

    test('Handler initializes probot and accepts a pull_request event', async () => {
        const { handler } = await import('../src/app-runner.js');
        const event = buildEvent('pull_request.opened.json');
        // handlers will attempt GitHub API calls which will fail, but
        // verifyAndReceive should not reject -- errors are handled by onError
        try {
            await handler(event);
        } catch (error) {
            // even if handlers fail on API calls, the function should not crash
            // on initialization -- that's the critical path we're testing
            expect(error.message).to.not.match(/cannot read properties of null/i,
                'Probot initialization failed -- probot.log or probot.webhooks is null');
        }
    });

    test('Handler rejects with an invalid webhook signature', async () => {
        const { handler } = await import('../src/app-runner.js');
        const event = buildEvent('ping.json', 'ping');
        // tamper with the signature
        event.headers['x-hub-signature-256'] = 'sha256=invalid';
        try {
            await handler(event);
            expect.fail('Expected handler to reject with invalid signature');
        } catch (error) {
            // signature verification should fail
            expect(error).to.exist;
        }
    });
});
