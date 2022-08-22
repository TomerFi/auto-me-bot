I take my instructions in _yaml_.</br>
If I can't find my configuration file in the repo I'm working with, I'll look for it in your _.github_ repo.

```yaml title=".github/auto-me-bot.yml"
---
pr:
  conventionalCommits: # (1)
    rules: # (2)
  signedCommits: # (3)
    ignore: # (4)
      users: []
      emails: []
  tasksList: # (5)
```

1. this means I'll enforce conventional commit messages in PRs.
2. you can optionally configure some rules for me.<br/> [see commitlint options](https://commitlint.js.org/#/reference-rules)
3. this means I'll make sure all commits in PRs are signed with the 'Signed-off-by' trailer.
4. you can optionally list users and/or emails for me to ignore.
5. this means I'll verify the completion of the tasks list in PRs.