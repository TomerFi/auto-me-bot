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

My name is [**auto-me-bot**][auto-me-bot-app]!</br>
I was created with [Probot][probot-pages] :robot: and I live my life
as a _serverless function_ residing in [AWS Lambda][aws-lambda] :floppy_disk:.</br>

I'm here to take some of the repo management load off your shoulders, just tell me what you want me to do...</br>
Place a file :memo: called **auto-me-bot.yml** in your **.github** folder :file_folder: in the repos you want me to help out with.</br>

```yaml
# .github/auto-me-bot.yml
---
pr:
  conventionalCommits: # this means I'll enforce conventional commit messages in PRs.
  lifecycleLabels: # this means you I'll label PRs based on the their lifecycle.
  signedCommits: # this means I'll make sure all commits in PRs are signed with the 'Signed-off-by' trailer.
  tasksList: # this means I'll verify completion of tasks list in PRs.
```

> Place the file in your **.github** repository if you want me to take on multiple repos with one file :muscle:.

Check out the [documentation][auto-me-bot-doc] to see what else I can do :call_me_hand:.

## Work Pics

[![all-handlers-success]][auto-me-bot-doc]

[![all-handlers-fail]][auto-me-bot-doc]

## Future Plans

- Size based labeling for pull requests.
- Automate assignees and reviewers for pull requests.
- Auto approving pull requests with consideration to GitHub code owners.
- Various handlers for event types other then _pull_request_, such as _push_ and and _issue_ event types.
- Repository management capabilities, such as labels creation and settings syncing.

## Alternatives

Other awesome applications the offer similar handlers as [auto-me-bot][auto-me-bot-app]:

- [DCO][dco]
- [Semantic Pull Request][semantic-pull-request]
- [Task List Completed][task-list-completed]
- [Trafico][trafico]

## Works well with

If you keep your commits conventional,</br>
you can use the [version-bumper-action][version-bumper-action] for _GitHub_, to automate your releases.

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/dolby360"><img src="https://avatars.githubusercontent.com/u/22151399?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Dolev Ben Aharon</b></sub></a><br /><a href="https://github.com/TomerFi/auto-me-bot/commits?author=dolby360" title="Code">💻</a> <a href="https://github.com/TomerFi/auto-me-bot/commits?author=dolby360" title="Documentation">📖</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

<!-- REAL LINKS -->
[auto-me-bot-app]: https://github.com/apps/auto-me-bot
[auto-me-bot-doc]: https://auto-me-bot.tomfi.info/
[aws-lambda]: https://aws.amazon.com/lambda/
[probot-pages]: https://probot.github.io/
[version-bumper-action]: https://github.com/TomerFi/version-bumper-action
<!-- IMAGE LINKS -->
[all-handlers-fail]: https://raw.githubusercontent.com/TomerFi/auto-me-bot/main/docs/img/all-handlers-fail.png
[all-handlers-success]: https://raw.githubusercontent.com/TomerFi/auto-me-bot/main/docs/img/all-handlers-success.png
<!-- ALTERNATIVES LINKS -->
[dco]: https://github.com/apps/dco
[semantic-pull-request]: https://github.com/apps/semantic-pull-requests
[task-list-completed]: https://github.com/marketplace/task-list-completed
[trafico]: https://github.com/marketplace/trafico-pull-request-labeler/
