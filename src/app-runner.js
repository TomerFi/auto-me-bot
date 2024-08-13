import { Probot } from 'probot'
import autoMeBot from './auto-me-bot.js'


// handler function for aws lambda >> 'Handler:src/app-runner.handler'
export async function handler (event) {
    let probot = new Probot({
        appId: process.env.APP_ID,
        privateKey: Buffer.from(process.env.PRIVATE_KEY, 'base64').toString('utf-8'),
        secret: process.env.WEBHOOK_SECRET,
        logLevel: process.env.PROBOT_LOG_LEVEL || 'info'
    });

    await probot.load(autoMeBot);

    return probot.webhooks.verifyAndReceive({
        id: event.headers['x-github-delivery'],
        name: event.headers['x-github-event'],
        signature: event.headers['x-hub-signature-256'],
        payload: event.body
    });
};
