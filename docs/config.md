```yaml title=".github/auto-me-bot.yml"
---
pr:
  lifecycleLabels: # (6)
    ignoreDrafts: false # (7)
    labels: # (8)
      reviewRequired: "status: needs review"
      changesRequested: "status: changes requested"
      moreReviewsRequired: "status: needs more reviews"
      reviewStarted: "status: review started"
      approved: "status: approved"
      merged: "status: merged"
  conventionalCommits: # (1)
    rules: # (2)
  conventionalTitle: # (9)
    rules: # (10)
  signedCommits: # (3)
    ignore: # (4)
      users: []
      emails: []
  tasksList: # (5)
  autoApprove: # (11)
    allBots: false
    users: ["dependabot"]
```

1. enforce conventional commit messages in PRs
2. optionally configure rules<br/>[see commitlint options](https://commitlint.js.org/#/reference-rules)
3. enforce all commits in PRs are signed with the 'Signed-off-by' trailer
4. optionally ignore specific users
5. verify completion of tasks list in PRs
6. label PRs based on their lifecycle
7. optionally ignore drafts, defaults to false
8. specify the lifecycle stages you want and their label text<br/>you'll need to create the labels yourself
9. enforce conventional title for PRs
10. optionally configure rules<br/>[see commitlint options](https://commitlint.js.org/#/reference-rules)
11. automatically approve specific PRs

???+ tip
    Place a configuration file in your _.github_ repo for global configuration.

???+ warning
    Create the actual labels in your repository before using them.
