# Auto-Me-Bot

> This is a WIP, not yet deployed publicly.

Managing a repository can be cumbersome :construction_worker: and tiresome :tired_face:.</br>
Let alone managing multiple repositories used by multiple contributors and bots :anguished:.</br>

My name is **auto-me-bot** :robot:.</br>
I'm here to take some of the load off your shoulders, just tell me what you want me to do...</br>
Place a file :memo: called **auto-me-bot.yml** in your **.github** folder :file_folder: in the repos you want help out with.</br>

You can also place the file in the **.github** folder in your **.github** repository,</br>
if you want me to take on multiple repos with one configuraion file :muscle:.

```yaml
# .github/auto-me-bot.yml
---
pr:
  # if you want me to enforce conventional commit messages on PRs.
  conventionalCommits:
  # if you want me to make sure all commits in PRs are signed with the 'Signed-off-by' trailer.
  signedCommits:
  # if you want me to enforce completion of tasks list on PRs.
  tasksList:
```

Checkout the [documentation](https://auto-me-bot.tomfi.info/) to see what else I can do :call_me_hand:.
