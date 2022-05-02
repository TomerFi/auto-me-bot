# Auto-Me-Bot

Managing a repository can be cumbersome :construction_worker: and tiresome :tired_face:.</br>
Let alone managing multiple repositories used by multiple contributors and bots :anguished:.</br>

My name is **auto-me-bot**!</br>
I was created with [Probot][1] :robot: and I live my life
as a _serverless function_ residing in [AWS Lambda][2] :floppy_disk:.</br>

I'm here to take some of the load off your shoulders, just tell me what you want me to do...</br>
Place a file :memo: called **auto-me-bot.yml** in your **.github** folder :file_folder: in the repos you want me to help out with.</br>

```yaml
# .github/auto-me-bot.yml
---
pr:
  conventionalCommits: # this means I'll enforce conventional commit messages in PRs.
  signedCommits: # this means I'll make sure all commits in PRs are signed with the 'Signed-off-by' trailer.
  tasksList: # this means I'll verify completion of tasks list in PRs.
```

> Place the file in your **.github** repository if you want me to take on multiple repos with one file :muscle:.

Check out the [documentation][0] to see what else I can do :call_me_hand:.

[![all-handlers-success]][0]

[![all-handlers-fail]][0]

<!-- REAL LINKS -->
[0]: https://auto-me-bot.tomfi.info/
[1]: https://probot.github.io/
[2]: https://aws.amazon.com/lambda/
<!-- IMAGE LINKS -->
[all-handlers-fail]: https://raw.githubusercontent.com/TomerFi/auto-me-bot/main/docs/img/all-handlers-fail.png
[all-handlers-success]: https://raw.githubusercontent.com/TomerFi/auto-me-bot/main/docs/img/all-handlers-success.png
