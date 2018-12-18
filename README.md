# @atomist/cli

[![npm version](https://badge.fury.io/js/%40atomist%2Fcli.svg)](https://badge.fury.io/js/%40atomist%2Fcli)

The Atomist CLI, a unified command-line tool for interacting with
[Atomist][atomist] services.

## Prerequisites

You will need [Node.js][node] installed to run the Atomist CLI.

To use local software delivery machine (SDM), you will need [Git][git]
installed.  See the [Local SDM][sdm-local] documentation for more
information.

To interact with the Atomist API, you will need an Atomist workspace.
See the [Atomist Getting Started Guide][atomist-start] for
instructions on how to get an Atomist workspace and connect it to your
source code repositories, continuous integration, chat platform, etc.
See the [Atomist Developer Guide][atomist-dev] for more complete
instructions on setting up your development environment.

[atomist-start]: https://docs.atomist.com/user/ (Atomist - Getting Started)
[atomist-dev]: https://docs.atomist.com/developer/prerequisites/ (Atomist - Developer Prerequisites)
[git]: https://git-scm.com/ (Git)
[node]: https://nodejs.org/ (Node.js)
[sdm-local]: https://github.com/atomist/sdm-local#readme (Atomist - Local Software Delivery Machine SDM)

## Installation

Briefly,

```
$ npm install -g @atomist/cli
```

see the [Atomist developer quick start][atomist-quick-start] for more
information.

[atomist-quick-start]: https://docs.atomist.com/quick-start/ (Atomist Developer Quick Start)

## Using

You can run `atomist --help` to see the standard help message.

### Configuration

You can use the Atomist CLI to configure your local environment to run
[software delivery machines (SDMs)][sdm] and other Atomist API
clients.

```
$ atomist connect
```

See the [Atomist developer prerequisites][atomist-dev] for more
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

### Fetch schema

You can fetch the current version of the GraphQL schema for your
Atomist workspace using the following command.

```
$ atomist gql-fetch
```

If you are defining custom types via registering ingestors in an SDM
or other API client, you should download the schema in each of your
SDM/API client projects prior to building them.

## Support

General support questions should be discussed in the `#support`
channel in the [Atomist community Slack workspace][slack].

If you find a problem, please create an [issue][].

[issue]: https://github.com/atomist/cli/issues

## Development

You will need to install [node][] to build and test this project.

[node]: https://nodejs.org/ (Node.js)

### Build and Test

Use the following package scripts to build, test, and perform other
development tasks.

Command | Reason
------- | ------
`npm install` | install project dependencies
`npm run build` | compile, test, lint, and generate docs
`npm start` | start the Atomist CLI
`npm run lint` | run TSLint against the TypeScript
`npm run compile` | compile TypeScript
`npm test` | run tests
`npm run autotest` | run tests every time a file changes
`npm run clean` | remove files generated during the build

### Release

Releases are managed by the [Atomist SDM][atomist-sdm].  Press the
release button in the Atomist dashboard or Slack.

[atomist-sdm]: https://github.com/atomist/atomist-sdm (Atomist Software Delivery Machine)

---

Created by [Atomist][atomist].
Need Help?  [Join our Slack workspace][slack].

[atomist]: https://atomist.com/ (Atomist - How Teams Deliver Software)
[slack]: https://join.atomist.com/ (Atomist Community Slack Workspace)
 
