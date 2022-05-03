<!-- markdownlint-disable MD033 -->
# <b>Auto-Me-Bot</b>

<p align="left">
  <table align="left">
    <td align="left"><a href=https://github.com/apps/auto-me-bot target="_blank">Install App</a></td>
    <td align="left"><a href="https://auto-me-bot.tomfi.info/" target="_blank">Read Docs</a></td>
    <td align="left"><a href="https://github.com/TomerFi/auto-me-bot/blob/main/.github/auto-me-bot.yml" target="_blank">Example Config</a></td>
  </table>
</p></br></br></br>

Managing a repository can be cumbersome :construction_worker: and tiresome :tired_face:.</br>
Let alone managing multiple repositories used by multiple contributors and bots :anguished:.</br>

My name is [**auto-me-bot**][1]!</br>
I was created with [Probot][2] :robot: and I live my life
as a _serverless function_ residing in [AWS Lambda][3] :floppy_disk:.</br>

I'm here to take some of the repo management load off your shoulders, just tell me what you want me to do...</br>
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

## Work Pics

[![all-handlers-success]][0]

[![all-handlers-fail]][0]

## Future Plans

- Size based labeling to pull requests.
- Various handlers for _push_ and and _issue_ events.
- Repository management capabilities, such as labels creation and settings syncing.

## Alternatives

Other awesome applications the offer similar handlers as [auto-me-bot][1]:

- [Semantic Pull Request][semantic-pull-request]
- [DCO][dco]
- [Task List Completed][task-list-completed]

## Works well with

If you keep your commits conventional,</br>
you can use the [version-bumper-action][version-bumper-action] for _GitHub_, to automate your releases.

<!-- REAL LINKS -->
[0]: https://auto-me-bot.tomfi.info/
[1]: https://github.com/apps/auto-me-bot
[2]: https://probot.github.io/
[3]: https://aws.amazon.com/lambda/
[version-bumper-action]: https://github.com/TomerFi/version-bumper-action
<!-- IMAGE LINKS -->
[all-handlers-fail]: https://raw.githubusercontent.com/TomerFi/auto-me-bot/main/docs/img/all-handlers-fail.png
[all-handlers-success]: https://raw.githubusercontent.com/TomerFi/auto-me-bot/main/docs/img/all-handlers-success.png
<!-- ALTERNATIVES LINKS -->
[dco]: https://github.com/apps/dco
[semantic-pull-request]: https://github.com/apps/semantic-pull-requests
[task-list-completed]: https://github.com/marketplace/task-list-completed
