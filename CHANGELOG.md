# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased][]

[Unreleased]: https://github.com/atomist/automation-seed-ts/compare/0.10.0...HEAD

## [0.10.0][] - 2018-04-13

[0.10.0]: https://github.com/atomist/automation-seed-ts/compare/0.9.0...0.10.0

GraphQL release

### Changed

-   Updated to use new GraphQL client interfaces

## [0.9.0][] - 2018-04-10

[0.9.0]: https://github.com/atomist/automation-seed-ts/compare/0.8.0...0.9.0

Hello release

### Added

-   HelloAutomation command handler

## [0.8.0][] - 2018-03-19

[0.8.0]: https://github.com/atomist/automation-seed-ts/compare/0.7.0...0.8.0

Configuration release

### Changed

-   Remove generated types when cleaning
-   Update @atomist/automation-client
-   Only install production dependencies in Docker build
-   Move sample Kubernetes deployment spec to assets/kube

### Removed

-   atomist.config.ts, it is no longer necessary

## [0.7.0][] - 2018-02-06

[0.7.0]: https://github.com/atomist/automation-seed-ts/compare/0.6.0...0.7.0

Kubernetes release

### Added

-   Kubernetes deployment specification and instructions

### Fixed

-   Docker CMD

## [0.6.0][] - 2018-02-05

[0.6.0]: https://github.com/atomist/automation-seed-ts/compare/0.5.0...0.6.0

Docker release

### Added

-   Docker build and push

### Changed

-   Moved GraphQL files under src

### Fixed

-   Fix autotest package script

## [0.5.0][] - 2018-01-31

[0.5.0]: https://github.com/atomist/automation-seed-ts/compare/0.4.0...0.5.0

Autostart release

### Changed

-   Travis CI build script sets local git config
-   Change autostart package script to avoid zombie processes
-   Travis CI build script does not npm publish by default, set
    NPM_PUBLISH environment variable to enable it

### Added

-   Travis CI build script can link Docker images to commits in
    Atomist
-   Travis CI build script can publish to S3 buckets

## [0.4.0][] - 2018-01-17

[0.4.0]: https://github.com/atomist/automation-seed-ts/compare/0.3.0...0.4.0

Build release

### Changed

-   Improve Docker handling in Travis CI build script
-   Update package scripts to use `atomist gql-gen` to generate
    TypeScript from GraphQL

## [0.3.0][] - 2018-01-08

[0.3.0]: https://github.com/atomist/automation-seed-ts/compare/0.2.0...0.3.0

Portable release

### Changed

-   Add no-install and no-compile options to `atomist start`
-   Use handler discovery rather than listing in atomist.config.ts
-   Updated TypeDoc generation
-   Make package scripts more standardized and portable

## [0.2.0][] - 2017-11-22

[0.2.0]: https://github.com/atomist/automation-seed-ts/compare/0.1.0...0.2.0

Update release

### Changed

-   Updated to @atomist/automation-client@0.2.0
-   Improve package scripts
-   Update test script to avoid mocha deprecated --compilers option
-   Cleaned up tests to use `.then(done, done)`
-   Updated to @atomist/automation-client 0.3.4

## [0.1.0][] - 2017-10-12

Initial release

[0.1.0]: https://github.com/atomist/automation-seed-ts/tree/0.1.0

### Added

-   HelloWorld command handler
-   NotifyOnPush event handler
