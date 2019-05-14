# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased](https://github.com/atomist/cli/compare/1.4.0...HEAD)

### Added

-   Add url to atomist kube command. [1b1a175](https://github.com/atomist/cli/commit/1b1a1754150243fcaf5a66894d607a4f95456901)
-   Publish latest tag for docker image on release. [#70](https://github.com/atomist/cli/issues/70)
-   Add support for starting an SDM from a remote repo. [#87](https://github.com/atomist/cli/issues/87)

## [1.4.0](https://github.com/atomist/cli/compare/1.3.0...1.4.0) - 2019-04-15

### Changed

-   When the APIkey is invalid, please ask for another one. [#69](https://github.com/atomist/cli/issues/69)
-   Spell out Kubernetes instead of k8s. [#78](https://github.com/atomist/cli/issues/78)
-   Make a more clear prompt than '? (mapped parameter) target-owner'. [#47](https://github.com/atomist/cli/issues/47)
-   If there is only one option, do not provide selector. [#80](https://github.com/atomist/cli/issues/80)

### Fixed

-   Fix create sdm undefined bug. [d1a04be](https://github.com/atomist/cli/commit/d1a04be2c135bda5697a497a179dfa4983aab758)

## [1.3.0](https://github.com/atomist/cli/compare/1.2.0...1.3.0) - 2019-04-01

### Added

-   Workspace selecter should validate that at least one is selected. [#62](https://github.com/atomist/cli/issues/62)
-   Add repository configuration to SCM provider command. [#75](https://github.com/atomist/cli/issues/75)

## [1.2.0](https://github.com/atomist/cli/compare/1.1.0...1.2.0) - 2019-03-15

### Added

-   Add `install` command to search and install an SDM extension pack from an NPM registry. [#b706d70](https://github.com/atomist/cli/commit/b706d70831e98cfcb7738d537bfc89b6af10198d)
-   Add provider and workspace create commands. [#61](https://github.com/atomist/cli/issues/61)
-   Add `provider config` command. [#64](https://github.com/atomist/cli/issues/64)

### Changed

-   Deploy k8s-sdm as part of `atomist kube`. [#65](https://github.com/atomist/cli/issues/65)
-   Add dry run and print current context to kube command. [#67](https://github.com/atomist/cli/issues/67)

## [1.1.0](https://github.com/atomist/cli/compare/1.0.3...1.1.0) - 2018-12-27

### Added

-   Add login, config command to connect to a workspace. [#57](https://github.com/atomist/cli/issues/57)

## [1.0.3](https://github.com/atomist/cli/compare/1.0.2...1.0.3) - 2018-12-08

### Changed

-   Update to apollo CLI for gql-fetch. [#52](https://github.com/atomist/cli/issues/52)

### Fixed

-   Fix some typos in the text intro for config. [#50](https://github.com/atomist/cli/issues/50)

## [1.0.2](https://github.com/atomist/cli/compare/1.0.1...1.0.2) - 2018-11-09

## [1.0.1](https://github.com/atomist/cli/compare/1.0.0-RC.2...1.0.1) - 2018-11-09

## [1.0.0-RC.2](https://github.com/atomist/cli/compare/1.0.0-RC.1...1.0.0-RC.2) - 2018-10-30

### Added

-   Add homebrew formula template and bash completion. [#46](https://github.com/atomist/cli/issues/46)

### Removed

-   **BREAKING** Remove deprecated git-info & gql-gen commands. [#45](https://github.com/atomist/cli/issues/45)

## [1.0.0-RC.1](https://github.com/atomist/cli/compare/1.0.0-M.5a...1.0.0-RC.1) - 2018-10-15

## [1.0.0-M.5a](https://github.com/atomist/cli/compare/1.0.0-M.5...1.0.0-M.5a) - 2018-09-28

## [1.0.0-M.5](https://github.com/atomist/cli/compare/1.0.0-M.4...1.0.0-M.5) - 2018-09-26

### Changed

-   Simplify postInstall message. [#35](https://github.com/atomist/cli/pull/35)

## [1.0.0-M.4](https://github.com/atomist/cli/compare/1.0.0-M.3...1.0.0-M.4) - 2018-09-16

## [1.0.0-M.3](https://github.com/atomist/cli/compare/1.0.0-M.2...1.0.0-M.3) - 2018-09-04

### Changed

-   Provided masked API key default and input. [#23](https://github.com/atomist/cli/issues/23)
-   Print more version information in --version. [#26](https://github.com/atomist/cli/issues/26)

### Removed

-   Remove deprecated scripts. [#24](https://github.com/atomist/cli/issues/24)

## [1.0.0-M.2](https://github.com/atomist/cli/compare/1.0.0-M.1...1.0.0-M.2)

### Changed

-   Update sdm-local and automation-client.

### Fixed

-   `atomist help` fails to show output. [#21](https://github.com/atomist/cli/issues/21)
-   Fix postInstall banner resolution.

## [1.0.0-M.1](https://github.com/atomist/cli/compare/0.6.7...1.0.0-M.1) - 2018-08-27

### Changed

-   Provide postInstall script as JavaScript.
-   Update Atomist dependencies to 1.0.0 Milestone 1 versions.

## [0.6.7](https://github.com/atomist/cli/compare/0.6.6...0.6.7) - 2018-08-25

### Added

-   Add postInstall message. [#11a7e91](https://github.com/atomist/cli/commit/11a7e9105582232e5f22c9a6bd9122472338972d)

## [0.6.6](https://github.com/atomist/cli/compare/0.6.5...0.6.6) - 2018-08-24

### Added

-   Add sourcemap support. [#12](https://github.com/atomist/cli/issues/12)

## [0.6.5](https://github.com/atomist/cli/compare/0.6.4...0.6.5) - 2018-08-22

### Changed

-   Use @atomist/automation-client bin scripts.

## [0.6.4](https://github.com/atomist/cli/compare/0.6.3...0.6.4) - 2018-08-21

### Fixed

-   Commands not working on MS Windows. [#2](https://github.com/atomist/cli/issues/2)
-   Get rid of deprecation warnings when installing cli. [#11](https://github.com/atomist/cli/issues/11)

## [0.6.3](https://github.com/atomist/cli/compare/0.6.2...0.6.3) - 2018-08-20

### Changed

-   Update to @atomist/sdm-local@0.1.8, @atomist/automation-client@0.21.1. [#ee928bc](https://github.com/atomist/cli/commit/ee928bcc578409117b78a2980c54ce3e7078ce97)

## [0.6.2](https://github.com/atomist/cli/compare/0.6.1...0.6.2) - 2018-08-20

### Changed

-   Update to @atomist/sdm-local@0.1.7.

## [0.6.1](https://github.com/atomist/cli/compare/0.6.0...0.6.1) - 2018-08-19

### Changed

-   Delay loading sdm-local in gitHook.

## [0.6.0](https://github.com/atomist/cli/compare/0.5.2...0.6.0) - 2018-08-14

### Added

-   Add `git-hook` subcommand.

### Changed

-   Update automation-client dependency.
-   Use automation-client scripts in package scripts.
-   Use cross-spawn to make running commands more cross-platform.

### Deprecated

-   The `git` and `gql-gen` subcommands have been moved to automation-client.
-   Deprecate `githook` script in favor of `git-hook` subcommand.

### Removed

-   **BREAKING** Remove `cmd` and `exec` aliases for `execute`.

### Fixed

-   Recognize `execute` as a reserved command.
-   Show SDM local commands in `--help` output. [#9](https://github.com/atomist/cli/issues/9)

## [0.5.2](https://github.com/atomist/cli/compare/0.5.1...0.5.2) - 2018-08-09

### Fixed

-   Update automation-client to make running "new sdm" outside a

## [0.5.1](https://github.com/atomist/cli/compare/0.5.0...0.5.1) - 2018-08-09

### Fixed

-   Move Atomist dependencies back from devDependencies.

## [0.5.0](https://github.com/atomist/cli/compare/0.4.0...0.5.0) - 2018-08-09

### Added

-   Add SDM local mode.

### Changed

-   Update dependencies.

### Fixed

-   Improve argument processing to avoid loading SDM local commands

## [0.4.0](https://github.com/atomist/cli/compare/0.3.0...0.4.0) - 2018-08-04

### Changed

-   Improve config handling of workspace/team IDs.
-   Always have config prompt for API key.

### Fixed

-   Properly sanitize command line before printing

## [0.3.0](https://github.com/atomist/cli/compare/0.2.1...0.3.0) - 2018-08-01

### Added

-   Add Command-line option for API key, `--api-key`.

### Removed

-   **BREAKING** Remove `--atomist-token` command-line option and its
-   **BREAKING** Remove config GitHub-related command-line options,

## [0.2.1](https://github.com/atomist/cli/compare/0.2.0...0.2.1) - 2018-07-31

### Changed

-   Update TypeScript and supporting packages.

### Fixed

-   Support both `src` and `lib` in GraphQL commands.

## [0.2.0](https://github.com/atomist/cli/compare/0.1.0...0.2.0) - 2018-07-31

### Added

-   Provide `--atomist-token` command-line option for config.

### Changed

-   **BREAKING** Updated command-line options and arguments to use
-   Reorganize package structure to be more standard Node.js.
-   Standardize command line processing.
-   **BREAKING** Workspace ID argument to gql-fetch is now an option
-   Use async functions where possible.
-   Improve the tslint configuration.

### Removed

-   SDM configuration helpers no longer necessary.
-   **BREAKING** Remove gql alias for gql-gen.

### Fixed

-   The kube command can be run repeatedly without error.
-   Improve config error handling.
-   The --version command-line option should always report the right

## [0.1.0](https://github.com/atomist/cli/tree/0.1.0) - 2018-07-06

### Added

-   Atomist CLI, migrated from @atomist/automation-client.
