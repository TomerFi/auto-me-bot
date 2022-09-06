I take my instructions in _yaml_.</br>
If I can't find my configuration file in the repo I'm working with, I'll look for it in your _.github_ repo.

```yaml title=".github/auto-me-bot.yml"
---
pr:
  conventionalCommits: # (1)
    rules: # (2)
  lifecycleLabels: # (8)
    ignoreDrafts: false # (9)
    labels: # (10)
      reviewRequired: "waiting for a review"
      changesRequested: "changes were requested"
      moreReviewsRequired: "approved but waiting for more reviews"
      reviewStarted: "a review was started"
      approved: "approved and ready"
      merged: "merged and done"
  signedCommits: # (3)
    ignore: # (4)
      users: [] # (6)
      emails: [] # (7)
  tasksList: # (5)
```

1. this means I'll enforce conventional commit messages in PRs.
2. you can optionally configure some rules for me.<br/>[see commitlint options](https://commitlint.js.org/#/reference-rules)
3. this means I'll make sure all commits in PRs are signed with the 'Signed-off-by' trailer.
4. you can optionally list users and/or emails for me to ignore.
5. this means I'll verify the completion of the tasks list in PRs.
6. list users you want my to ignore.
7. list email addresses you want my to ignore.
8. this means you I'll label PRs based on the their lifecycle.
9. you can optionally instruct me to ignore drafts, my default value for this is false for including drafts.
10. you don't have to specify all of the lifecycle's stages, just the ones you want.<br/>and I don't create the labels yet, so you'll have to create them.
