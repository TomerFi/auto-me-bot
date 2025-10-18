# 🤖 Auto-Me-Bot

🚧 Managing a repository can be cumbersome and tiresome.<br/>
🤖 [auto-me-bot][app] is here to take some of the load off your shoulders!

📖 Check the docs: [https://auto-me-bot.figenblat.com][docs]<br/>
🖱️ Install the app: [https://github.com/apps/auto-me-bot][app]

> [!Tip]
> If you enforce conventional commit messages, use [version-bumper-action][vba] to automate your release process.

---

```yaml
# .github/auto-me-bot.yml - check the docs for a complete example
---
pr:
  lifecycleLabels: # label PRs based on their lifecycle
  conventionalCommits: # enforce conventional commit messages in PRs
  conventionalTitle: # enforce conventional title for PRs
  signedCommits: # enforce all commits in PRs are signed with the 'Signed-off-by' trailer
  tasksList: # verify completion of tasks list in PRs
  autoApprove: # automatically approve specific PRs
```
![success]

[app]: https://github.com/apps/auto-me-bot
[docs]: https://auto-me-bot.figenblat.com
[vba]: https://github.com/TomerFi/version-bumper-action
[success]: https://raw.githubusercontent.com/TomerFi/auto-me-bot/main/docs/img/all-handlers-success.png
