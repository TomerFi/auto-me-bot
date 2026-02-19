import { Probot } from 'probot'
import autoMeBot from './auto-me-bot.js'


// handler function for gcp cloud functions (2nd gen)
export async function handler (req, res) {
    try {
        const probot = new Probot({
            appId: process.env.APP_ID,
            privateKey: Buffer.from(process.env.PRIVATE_KEY, 'base64').toString('utf-8'),
            secret: process.env.WEBHOOK_SECRET,
            logLevel: process.env.LOG_LEVEL || 'info',
        });

        await probot.ready();
        probot.log.debug('loading app');
        await probot.load(autoMeBot);
        probot.log.debug('app loaded, starting webhook');

        await probot.webhooks.verifyAndReceive({
            id: req.headers['x-github-delivery'],
            name: req.headers['x-github-event'],
            signature: req.headers['x-hub-signature-256'],
            payload: req.rawBody.toString(),
        });

        res.status(200).send('ok');
    } catch (error) {
        console.error('Handler error:', error);
        res.status(500).send('error');
    }
}
