# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased](https://github.com/atomist/cli/compare/1.0.0-M.1...HEAD)

### Changed

-   Provided masked API key default and input. [#23](https://github.com/atomist/cli/issues/23)

### Fixed

-   `atomist help` fails to show output. [#21](https://github.com/atomist/cli/issues/21)

## [1.0.0-M.1](https://github.com/atomist/cli/compare/0.6.7...1.0.0-M.1) - 2018-08-27

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

## [0.2.0](https://github.com/atomist/cli/compare/0.1.0...0.2.0) - 2017-07-31

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
