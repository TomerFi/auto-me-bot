<h1 align="center">
  Auto-Me-Bot
</h1>

<p align="center">
  Managing a repository can be cumbersome :construction_worker: and tiresome :tired_face:.<br/>
  Let alone managing multiple repositories used by multiple contributors and bots :anguished:.<br/><br/>
  <strong>
  My name is <a href="https://github.com/apps/auto-me-bot">auto-me-bot 🤖</a> I'm here to take some of the repo management load off your shoulders!
  </strong>
</p>

<p align="center">
  <table align="center">
    <td align="left"><a href=https://github.com/apps/auto-me-bot target="_blank">Install App</a></td>
    <td align="left"><a href="https://auto-me-bot.tomfi.info/" target="_blank">Read Docs</a></td>
    <td align="left"><a href="https://github.com/TomerFi/auto-me-bot/blob/main/.github/auto-me-bot.yml" target="_blank">Example Config</a></td>
  </table>
</p>

<a href="https://auto-me-bot.tomfi.info/">
  <img align="center" src="https://raw.githubusercontent.com/TomerFi/auto-me-bot/main/docs/img/all-handlers-success.png" alt="all-handlers-success"/>
<a/>

<details>
  <summary><strong>Failed Checks</strong></summary>
  <a href="https://auto-me-bot.tomfi.info/">
    <img align="center" src="https://raw.githubusercontent.com/TomerFi/auto-me-bot/main/docs/img/all-handlers-fail.png" alt="all-handlers-fail"/>
  <a/>
  </summary>
</details>

<details>
  <summary><strong>Configuration</strong></summary>
  <p align="left">
    Place a file :memo: called <em>auto-me-bot.yml</em> in your <em>.github</em> folder :file_folder: in the repos you want me to help out with.<br/>
    Check out the <a href="https://auto-me-bot.tomfi.info/">documentation</a> to see what else I can do :call_me_hand:.

```yaml
# .github/auto-me-bot.yml
---
pr:
  conventionalCommits: # this means I'll enforce conventional commit messages in PRs.
  lifecycleLabels: # this means you I'll label PRs based on the their lifecycle.
  signedCommits: # this means I'll make sure all commits in PRs are signed with the 'Signed-off-by' trailer.
  tasksList: # this means I'll verify completion of tasks list in PRs.
```

  </p>
  </summary>
</details>

<details>
  <summary><strong>Future Plans</strong></summary>
  <ul>
    <li>Size based labeling for pull requests</li>
    <li>Automate assignees and reviewers for pull requests</li>
    <li>Auto approving pull requests with consideration to GitHub code owners</li>
    <li>Various handlers for event types other then <em>pull_request</em, such as <em>push</em> and and <em>issue</em> event types</li>
    <li>Repository management capabilities, such as labels creation and settings syncing</li>
  </ul>
</details>

<details>
  <summary><strong>Alternatives</strong></summary>
  <p>Other awesome applications the offer similar handlers as <a href="https://github.com/apps/auto-me-bot">auto-me-bot</a></p>
  <ul>
    <li><a href="https://github.com/apps/dco">DCO</a></li>
    <li><a href="https://github.com/apps/semantic-pull-requests">Semantic Pull Request</a></li>
    <li><a href="https://github.com/marketplace/task-list-completed">Task List Completed</a></li>
    <li><a href="https://github.com/marketplace/trafico-pull-request-labeler">Trafico</a></li>
  </ul>
</details>

<details>
  <summary><strong>Works well with</strong></summary>
  <p>
    If you keep your commits conventional,<br/>
    you can use the <a href="https://github.com/TomerFi/version-bumper-action">version-bumper-action</a> for <em>GitHub</em>, to automate your releases.
  </p>
</details>

<details>
  <summary><strong>Contributors</strong></summary>
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

</details>
