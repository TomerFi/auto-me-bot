# Auto-Me-Bot

> This is a WIP, not yet deployed.

Managing a repository can be cumbersome :construction_worker: and tiresome :tired_face:.</br>
Let alone managing multiple repositories used by multiple contributors and bots :anguished:.</br>

My name is **auto-me-bot** :robot:.</br>
I'm here to take some of the load off your shoulders, just tell me what you want me to do...</br>

If you want my help :palms_up_together:,</br>
place a file :memo: called **auto-me-bot.yml** in your **.github** folder :file_folder: in the repos you want help out with.</br>
You can also place the file in the **.github** folder in your **.github** repository,</br>
if you want me to take on all of your repos :muscle:.

```yaml
# .github/auto-me-bot.yml
---
pr:
  # if you want me to enforce conventional commit messages on PRs, just add conventionalCommits.
  # I'll report back with my findings.
  conventionalCommits:
  # if you want me to enforce completion of tasks list on PRs, just add tasksList.
  # I'll provide a detailed list of what needs to be done.
  tasksList:
```
