# @atomist/cli

[![npm version](https://badge.fury.io/js/%40atomist%2Fcli.svg)](https://badge.fury.io/js/%40atomist%2Fcli)

The Atomist CLI, a unified command-line tool for interacting with
[Atomist][atomist] services.

## Prerequisites

See the [Atomist getting started][enrollment] documentation.

[enrollment]: https://docs.atomist.com/user/ (Atomist - Getting Started)

## Installation

Briefly,

```
$ npm install -g @atomist/cli
```

see the [Atomist developer quick start][atomist-quick-start] for more
information.

[atomist-quick-start]: https://docs.atomist.com/quick-start/ (Atomist Developer Quick Start)

## Using

### Configuration

You can use the Atomist CLI to configure your local environment to run
[software delivery machines (SDMs)][sdm] and other Atomist API
clients.

```
$ atomist config
```

See the [Atomist developer quick start][atomist-quick-start] for more
information.

[sdm]: https://docs.atomist.com/ (Atomist Documentation)

### Kubernetes

You can use the Atomist CLI to install the Atomist Kubernetes
utilities in your Kubernetes cluster:

```
$ atomist kube --environment=MY_CLUSTER
```

replacing `MY_CLUSTER` with a meaningful name for the Kubernetes
cluster your `kubectl` utility is configured to communicate with.  See
the [Atomist Kubernetes documentation][atomist-k8] for more
information.

[atomist-k8]: https://docs.atomist.com/user/kubernetes/ (Atomist Kubernetes)

## Support

General support questions should be discussed in the `#support`
channel in our community Slack team
at [atomist-community.slack.com][slack].

If you find a problem, please create an [issue][].

[issue]: https://github.com/atomist/cli/issues

## Development

You will need to install [node][] to build and test this project.

[node]: https://nodejs.org/ (Node.js)

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
