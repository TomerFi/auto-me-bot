Install **auto-me-bot** for GitHub [here](https://github.com/apps/auto-me-bot).

???- note "Triggering events"
    - pull_request
    - pull_request_review

???- note "Required permissions"
    | scope                   | permission |
    | ----------------------- | ---------- |
    | .github/auto-me-bot.yml | read       |
    | administration          | read       |
    | checks                  | write      |
    | metadata                | read       |
    | pull_requests           | write      |

    > metadata:read is mandatory.
