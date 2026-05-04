# Skill: Deployment Ops

Deploy auto-me-bot, verify service health, analyze logs, and troubleshoot post-deploy issues.

## What I do

- Deploy auto-me-bot to GCP Cloud Run via Cloud Functions Gen2
- Verify post-deploy health: service status, revision readiness, traffic split
- Analyze logs for errors, HTTP issues, latency patterns, cold starts
- Run deployment verification: compare revision names, check smoke-test workflow
- Troubleshoot common issues: secrets access, GitHub token problems, scale-from-zero

## When to use me

Use when deploying auto-me-bot, checking post-deploy health, analyzing runtime logs, or troubleshooting production issues.

## Environment

- GCP project: `auto-me-bot`
- Region: `us-central1`
- Service: Cloud Function `auto-me-bot` on Cloud Run
- Runtime: Node.js 22
- Secrets: APP\_ID, PRIVATE\_KEY, WEBHOOK\_SECRET (Secret Manager)
- Deployer SA: `deployer@auto-me-bot.iam.gserviceaccount.com` (GitHub Actions WIF)
- `allUsers` invoker access is set manually, not via CI
- `--allow-unauthenticated` flag is NOT used; `allUsers` invoker access is set manually

## Post-Deploy Health Check

1. Verify service status: `gcloud run services describe auto-me-bot --region=us-central1`
2. Confirm latest revision is ready and serving 100% traffic
3. Check for ERROR severity logs since deployment
4. Check for HTTP 4xx/5xx responses
5. Check stderr for application-level errors
6. Review request latencies for cold-start impact

## Troubleshooting Playbook

### Service not ready

- Check revision conditions for error messages
- Common: secret access denied (Secret Manager IAM), container health check failures

### HTTP 500s

- Check stderr for stack traces
- Common: GitHub App token issues (expired, revoked, repo access blocked)

### High latency

- Cold starts: ~400-500ms (expected for scale-from-zero)
- Warm requests: ~5ms
- If consistently high: check if `startup-cpu-boost` annotation is enabled

### "no config found" in logs

- Normal behavior: the webhook came from a repo without `.github/auto-me-bot.yml`
- Returns HTTP 200, not an error

## Deployment Verification

After a release deploy (`release.yml`):

1. Run post-deploy health check above
2. Compare revision name to the previous one to confirm the new revision is active
3. If smoke-test workflow exists, check its status
4. Monitor for 10-15 minutes for delayed issues (cold start errors, secret rotation)
