# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased](https://github.com/atomist/cli/compare/0.5.1...HEAD)

## [0.5.1](https://github.com/atomist/cli/compare/0.5.0...0.5.1) - 2018-08-09

### Fixed

-  Move Atomist dependencies back from devDependencies.

## [0.5.0](https://github.com/atomist/cli/compare/0.4.0...0.5.0) - 2018-08-09

### Added

-   Add SDM local mode.

### Changed

-   Update dependencies.

### Fixed

-   Improve argument processing to avoid loading SDM local commands
    when it is unnecessary.

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
    `-T` alias, see `--api-key`.
-   **BREAKING** Remove config GitHub-related command-line options,
    see `--api-key`.

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
    workspace rather than team and atomist-token rather than token.
-   Reorganize package structure to be more standard Node.js.
-   Standardize command line processing.
-   **BREAKING** Workspace ID argument to gql-fetch is now an option
    and will be read from the user config if not provided.
-   Use async functions where possible.
-   Improve the tslint configuration.

### Fixed

-   The kube command can be run repeatedly without error.
-   Improve config error handling.
-   The --version command-line option should always report the right
    version.

### Removed

-   SDM configuration helpers no longer necessary.
-   **BREAKING** Remove gql alias for gql-gen.

## [0.1.0](https://github.com/atomist/cli/tree/0.1.0) - 2018-07-06

### Added

-   Atomist CLI, migrated from @atomist/automation-client.
