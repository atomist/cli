# cli

the Atomist CLI

[![npm version](https://badge.fury.io/js/%40atomist%2Fautomation-seed.svg)](https://badge.fury.io/js/%40atomist%2Fautomation-seed)

This repository contains examples demonstrating use of
the [Atomist][atomist] API.  You will find examples illustrating:

-   Creating bot commands using _command handlers_
-   Responding to DevOps events, e.g., commits pushed to a repository,
    using _event handlers_

These examples use the [`@atomist/automation-client`][client] node
module to implement a local client that connects to the Atomist API.

[client]: https://github.com/atomist/automation-client-ts (@atomist/automation-client Node Module)

## Prerequisites

See the [Atomist getting started][enrollment] documentation.

[enrollment]: https://github.com/atomist/welcome/blob/master/enroll.md (Atomist - Getting Started)

Below are brief instructions on how to get started running this
project yourself.  If you just want to use the core functionality of
Atomist, see the [Atomist documentation][docs].  For more detailed
information on developing automations, see the [Atomist Developer
Guide][dev].

[docs]: https://docs.atomist.com/ (Atomist User Guide)
[dev]: https://docs.atomist.com/developer/ (Atomist Developer Guide)

### GitHub account

You must have a GitHub account, either GitHub.com or GitHub Enterprise
(GHE).  If you want to use Atomist with GHE, please [contact
Atomist](mailto:support@atomist.com).  The remainder of these
instructions assume you have a GitHub.com account.  If you do not
already have a GitHub.com account, you can [create
one][github-create].

To run automations, you will need a GitHub [personal access
token][token] with "read:org" scope.  You can create one yourself or
use the Atomist CLI to do it for you (see below).

[github-create]: https://github.com/join (Join GitHub)
[token]: https://github.com/settings/tokens (GitHub Personal Access Tokens)

### Atomist workspace

You also need to sign up with Atomist and create a workspace.  Once
you have a GitHub.com account, you can sign up with Atomist at
[https://app.atomist.com/][atm-app].  Once you are registered with
Atomist, you can create an Atomist workspace and add your GitHub user
and/or organizations to that workspace.

Once you have created your Atomist workspace, take note of your
Atomist workspace/team ID.  You can always find your Atomist workspace
ID on the workspace's settings page or, if you have added the Atomist
app to Slack, you can send the Atomist bot the message `team` and it
will tell you the workspace/team ID.

[atm-app]: https://app.atomist.com/ (Atomist Web Interface)

### Slack

Atomist has a powerful [Slack][slackhq] application, allowing you to
see and act on your development activity right in Slack.  Slack is not
a requirement for using Atomist, but if you try it, you'll probably
like it.  If you do not have access to a Slack team, it is easy to
[create your own][slack-team].

In your Slack team, install the Atomist app in Slack, click the button
below.

<p align="center">
 <a href="https://atm.st/2wiDlUe">
  <img alt="Add to Slack" height="50" width="174" src="https://platform.slack-edge.com/img/add_to_slack@2x.png" />
 </a>
</p>

Once installed, the Atomist bot will guide you through connecting
Atomist, Slack, and GitHub.

[slackhq]: https://slack.com/ (Slack)
[slack-team]: https://slack.com/get-started#create (Create a Slack Team)

### Configuration

Once you have GitHub and Atomist set up, install the Atomist CLI and
configure your local environment.

```console
$ npm install -g @atomist/automation-client
$ atomist config
```

The second command does two things: records what Atomist
workspace/team you want your automations running in and creates a
[GitHub personal access token][token] with "repo" and "read:org"
scopes.

The script will prompt you for your Atomist workspace/team ID, or you
can supply it using the `--team TEAM_ID` command-line option.  You can
get your Atomist team ID from the settings page for your Atomist
workspace or by typing `team` in a DM to the Atomist bot.

The script will prompt you for your GitHub credentials.  It needs them
to create the GitHub personal access token.  Atomist does not store
your credentials and only writes the generated token to your local
machine.

The Atomist API client authenticates using a GitHub personal access
token.  The Atomist API uses the token to confirm you are who you say
you are and are in a GitHub organization connected to the Slack team
in which you are running the automations.  In addition, it uses the
token when performing any operations that access the GitHub API.

## Running

You can run this automation using its Docker container, e.g., in
Kubernetes, or locally.

### Docker and Kubernetes

To download and run the Docker image of this project, run the
following command

```console
$ docker run --rm -e ATOMIST_TOKEN=YOUR_TOKEN -e ATOMIST_TEAMS=TEAM_ID \
    atomist/automation-seed-ts:VERSION
```

replacing `YOUR_TOKEN` and `TEAM_ID` with the token and team ID from
your `~/.atomist/client.config.json` created above by the `atomist
config` command and `VERSION` with the [latest release of this
repo][latest].  Note that this will not be running any code from your
local machine but the code in the Docker image.

To run the Docker image in a Kubernetes cluster, you can use the
[deployment spec](assets/kube/deployment.yaml) from this repository as
a starting point.  Before creating the deployment resource, you will
need to create a secret with the following command, replacing `TOKEN`
and `TEAM_ID` as above.

```console
$ kubectl create secret generic automation --from-file=$HOME/.atomist/client.config.json
$ kubectl create -f assets/kube/deployment.yaml
```

[latest]: https://github.com/atomist/automation-seed-ts/releases/latest

### Locally

You will need to have [Node.js][node] installed.  To verify that the
right versions are installed, run:

```console
$ node -v
v9.7.1
$ npm -v
5.6.0
```

The `node` version should be 8 or greater and the `npm` version should
be 5 or greater.

[node]: https://nodejs.org/ (Node.js)

#### Cloning the repository and installing dependencies

To get started run the following commands to clone the project,
install its dependencies, and build the project:

```console
$ git clone git@github.com:atomist/automation-seed-ts.git
$ cd automation-seed-ts
$ npm install
$ npm run build
```

#### Starting up the automation-client

You can run this repository locally, allowing you to change the source
code of this project and immediately see the effects in your environment
with the following command

```console
$ npm run autostart
```

To run in a more traditional manner, build the project and then simple
start it.

```console
$ npm start
```

## Using

### Invoking a command handler from Slack

This project contains the code to create and respond to a simple
`hello world` bot command.  The code that defines the bot command and
implements responding to the command, i.e., the _command handler_, can
be found in [`HelloWorld.ts`][hello].  Once you have your local
automation client running (the previous step in this guide), you can
invoke the command handler by sending the Atomist bot the command as a
message.  Be sure the Atomist bot is in the channel before sending it
the message.

```
/invite @atomist
@atomist hello world
```

Once you've submitted the command in Slack, you'll see the incoming
and outgoing messages show up in the logs of your locally running
automation-client.  Ultimately, you should see the response from the
bot in Slack.

[hello]: https://github.com/atomist/automation-seed-ts/blob/master/src/commands/HelloWorld.ts (HelloWorld Command Handler)

Feel free to modify the code in the `HelloWorld` command handler,
Node.js will automatically reload the client, and see what happens!

### Triggering an event handler

While command handlers respond to commands you send the Atomist bot,
_event handlers_ take action when different types of events occur in
your development and operations environment.  Some examples of events
are commits pushed to a repo, or a CI build that fails, or an instance
of a running service that becomes unhealthy.  Example responses to those
events are showing the commits in a Slack message, automatically
restarting the build, and triggering a PagerDuty alert, respectively.

The sample event handler in this project, [NotifyOnPush][nop-handler],
will notice when someone pushes new commits to a repository in the
GitHub organization and send a notice of that push to all Slack
channels associated with that repository.

If you have followed the instructions above and are running these
automations against the atomist-playground Slack team and GitHub
organization, go ahead and edit the [notify-on-push][nop-repo]
repository by adding some text to its [README][nop-readme].  Once you
have saved your changes, you should see that event appear in the
console logs of your locally running automation client, followed by a
log of the actions the event handler is taking.  Once those actions
are complete, you should see a new message in the
[`#notify-on-push`][nop-channel] channel in the atomist-playground
Slack team.

[nop-handler]: https://github.com/atomist/automation-seed-ts/blob/master/src/events/NotifyOnPush.ts (Atomist NotifyOnPush Event Handler)
[nop-repo]: https://github.com/atomist-playground/notify-on-push (Atomist NotifyOnPush Repository)
[nop-readme]: https://github.com/atomist-playground/notify-on-push/edit/master/README.md (Edit NotifyOnPush README)
[nop-channel]: https://atomist-playground.slack.com/messages/C7GNF6743/ (NotifyOnPush Slack Channel)

## Support

General support questions should be discussed in the `#support`
channel in our community Slack team
at [atomist-community.slack.com][slack].

If you find a problem, please create an [issue][].

[issue]: https://github.com/atomist/automation-seed-ts/issues

## Development

You will need to install [node][] to build and test this project.

### Build and Test

Command | Reason
------- | ------
`npm install` | install all the required packages
`npm run build` | lint, compile, and test
`npm start` | start the Atomist automation client
`npm run autostart` | run the client, refreshing when files change
`npm run lint` | run tslint against the TypeScript
`npm run compile` | compile all TypeScript into JavaScript
`npm test` | run tests and ensure everything is working
`npm run autotest` | run tests continuously
`npm run clean` | remove stray compiled JavaScript files and build directory

### Release

Releases are managed by the [Atomist SDM][atomist-sdm].  Press the
"Release" button in the Atomist dashboard or Slack.

[atomist-sdm]: https://github.com/atomist/atomist-sdm (Atomist Software Delivery Machine)

---

Created by [Atomist][atomist].
Need Help?  [Join our Slack team][slack].

[atomist]: https://atomist.com/ (Atomist - How Teams Deliver Software)
[slack]: https://join.atomist.com/ (Atomist Community Slack)
