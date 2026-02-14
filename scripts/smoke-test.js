import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

// load .env if present (no external dependencies, optional for CI)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');
try {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const val = match[2].trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) process.env[key] = val;
        }
    }
} catch {
    // no .env file -- rely on environment variables (e.g. in CI)
}

const FUNCTION_URL = process.env.FUNCTION_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

if (!FUNCTION_URL) {
    console.error('FUNCTION_URL is not set in .env');
    process.exit(1);
}
if (!WEBHOOK_SECRET) {
    console.error('WEBHOOK_SECRET is not set in .env');
    process.exit(1);
}

// discover available events from payloads directory
// filename format: <event-name>.json where dots in event name map to dots in filename
// e.g. pull_request.opened.json -> event "pull_request", action "opened"
//      ping.json -> event "ping", no action
const payloadsDir = resolve(__dirname, '..', 'tests', 'fixtures');
const EVENTS = {};
for (const file of readdirSync(payloadsDir).filter(f => f.endsWith('.json'))) {
    const label = basename(file, '.json');
    const parts = label.split('.');
    // first part before the dot is the github event name (e.g. "pull_request", "pull_request_review")
    // but event names can contain underscores, so we use the payload's action field to determine the split
    const payload = JSON.parse(readFileSync(resolve(payloadsDir, file), 'utf-8'));
    const eventName = payload.action ? label.slice(0, label.lastIndexOf('.')) : label;
    EVENTS[label] = { name: eventName, payload };
}

// sign a payload the same way GitHub does
function sign(payload) {
    return 'sha256=' + createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
}

// send a webhook event to the function
async function sendEvent(eventName, payload) {
    const body = JSON.stringify(payload);
    const deliveryId = randomUUID();
    const signature = sign(body);

    console.log(`Sending '${eventName}' event (delivery: ${deliveryId})...`);

    const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-github-delivery': deliveryId,
            'x-github-event': eventName,
            'x-hub-signature-256': signature,
        },
        body,
    });

    const responseBody = await response.text();
    return { status: response.status, body: responseBody };
}

const MAX_RETRIES = Number(process.env.SMOKE_RETRIES) || 3;
const RETRY_DELAY_MS = Number(process.env.SMOKE_RETRY_DELAY_MS) || 5000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runOne(label, eventName, payload) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const { status, body } = await sendEvent(eventName, payload);
            if (status >= 200 && status < 300) {
                console.log(`  ${label}: OK (${status})`);
                return true;
            }
            console.error(`  ${label}: FAILED (${status})${attempt < MAX_RETRIES ? ' - retrying...' : ''}`);
            if (body) console.error(`  Response: ${body}`);
        } catch (error) {
            console.error(`  ${label}: ERROR - ${error.message}${attempt < MAX_RETRIES ? ' - retrying...' : ''}`);
        }
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
    return false;
}

async function main() {
    const arg = process.argv[2] || 'ping';
    const labels = Object.keys(EVENTS).sort();

    if (arg !== 'all' && !(arg in EVENTS)) {
        console.error(`Unknown event type: ${arg}`);
        console.error(`Supported events: ${labels.join(', ')}, all`);
        process.exit(1);
    }

    let failed = false;

    if (arg === 'all') {
        console.log('Running all smoke tests...\n');
        for (const label of labels) {
            const event = EVENTS[label];
            const ok = await runOne(label, event.name, event.payload);
            if (!ok) failed = true;
        }
        console.log(failed ? '\nSome tests failed.' : '\nAll tests passed.');
    } else {
        const event = EVENTS[arg];
        const ok = await runOne(arg, event.name, event.payload);
        if (!ok) failed = true;
    }

    process.exit(failed ? 1 : 0);
}

main();
