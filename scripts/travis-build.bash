#!/bin/bash
# build and test a node package on Travis CI

set -o pipefail

declare Pkg=travis-build-node
declare Version=1.5.1

# write message to standard out (stdout)
# usage: msg MESSAGE
function msg() {
    echo "$Pkg: $*"
}

# write message to standard error (stderr)
# usage: err MESSAGE
function err() {
    msg "$*" 1>&2
}

# git tag and push
# usage: git-tag TAG[...]
function git-tag () {
    if [[ ! $1 ]]; then
        err "git-tag: missing required argument: TAG"
        return 10
    fi

    if ! git config user.email "travis-ci@atomist.com"; then
        err "failed to set git user email"
        return 1
    fi
    if ! git config user.name "Travis CI"; then
        err "failed to set git user name"
        return 1
    fi
    local tag
    for tag in "$@"; do
        if ! git tag "$tag" -m "Generated tag from Travis CI build $TRAVIS_BUILD_NUMBER"; then
            err "failed to create git tag: '$tag'"
            return 1
        fi
    done
    local remote=origin
    if [[ $GITHUB_TOKEN ]]; then
        remote=https://$GITHUB_TOKEN:x-oauth-basic@github.com/$TRAVIS_REPO_SLUG.git
    fi
    if ! git push --quiet "$remote" "$@" > /dev/null 2>&1; then
        err "failed to push git tag(s): $*"
        return 1
    fi
}

# create and set a prerelease timestamped, and optionally branched, version
# usage: set-timestamp-version [BRANCH]
function set-timestamp-version () {
    local branch=$1 prerelease
    if [[ $branch && $branch != master ]]; then
        shift
        local safe_branch
        safe_branch=$(echo -n "$branch" | tr -C -s '[:alnum:]-' . | sed -e 's/^[-.]*//' -e 's/[-.]*$//')
        if [[ $? -ne 0 || ! $safe_branch ]]; then
            err "failed to create safe branch name from '$branch': $safe_branch"
            return 1
        fi
        prerelease=$safe_branch.
    fi

    local pkg_version pkg_json=package.json
    pkg_version=$(jq -er .version "$pkg_json")
    if [[ $? -ne 0 || ! $pkg_version ]]; then
        err "failed to parse version from $pkg_json"
        return 1
    fi
    local timestamp
    timestamp=$(date -u +%Y%m%d%H%M%S)
    if [[ $? -ne 0 || ! $timestamp ]]; then
        err "failed to generate timestamp"
        return 1
    fi
    local project_version=$pkg_version-$prerelease$timestamp
    if ! npm version --git-tag-version false "$project_version"; then
        err "failed to set package version: $project_version"
        return 1
    fi
}

# npm publish
# usage: npm-publish [NPM_PUBLISH_ARGS]...
function npm-publish () {
    if [[ ! $NPM_PUBLISH ]]; then
        msg "NPM_PUBLISH not set, skipping npm publish"
        return 0
    fi

    if ! cp -r build/src/* .; then
        err "packaging module failed"
        return 1
    fi

    if ! npm publish "$@"; then
        err "failed to publish node package"
        cat "$(ls -t "$HOME"/.npm/_logs/*-debug.log | head -n 1)"
        return 1
    fi

    local pub_file pub_base
    for pub_file in build/src/*; do
        pub_base=${pub_file#build/src/}
        rm -rf "$pub_base"
    done
}

# post a status on a commit
# usage: git-status [CONTEXT [DESCRIPTION [URL [STATE]]]]
function git-status () {
    local context=$1
    if [[ $context ]]; then
        shift
    else
        context=default
    fi
    local description=$1
    if [[ $description ]]; then
        shift
    fi
    local target_url=$1
    if [[ $target_url ]]; then
        shift
    fi
    local state=$1
    if [[ $state ]]; then
        shift
        case "$state" in
            error | failure | pending | success)
                :;;
            *)
                err "invalid commit status state: '$state'"
                return 10
                ;;
        esac

    else
        state=success
    fi

    local sha
    if [[ $TRAVIS_PULL_REQUEST_SHA ]]; then
        sha=$TRAVIS_PULL_REQUEST_SHA
    else
        sha=$TRAVIS_COMMIT
    fi

    local status_url=https://api.github.com/repos/$TRAVIS_REPO_SLUG/statuses/$sha
    local post_data
    printf -v post_data '{"state":"%s","target_url":"%s","description":"%s","context":"%s"}' "$state" "$target_url" "$description" "$context"
    if ! curl -s -f -H 'Accept: application/vnd.github.v3+json' \
            -H 'Content-Type: application/json' \
            -H "Authorization: token $GITHUB_TOKEN" \
            -X POST -d "$post_data" "$status_url" > /dev/null
    then
        err "failed to post status on commit: $sha"
        return 1
    fi
}

# publish a public prerelease version to non-standard registry
# usage: npm-publish-prerelease [BRANCH]
function npm-publish-prerelease () {
    local pkg_version=$1
    if [[ ! $pkg_version ]]; then
        err "npm-publish-prerelease: missing required argument: PACKAGE_VERSION"
        return 10
    fi
    shift

    if [[ ! $NPM_REGISTRY ]]; then
        msg "no team NPM registry set"
        msg "skipping prerelease package publication"
        return 0
    fi

    if ! npm-publish --registry "$NPM_REGISTRY" --access public; then
        err "failed to publish to NPM registry '$NPM_REGISTRY'"
        return 1
    fi

    local pkg_name pkg_json=package.json
    pkg_name=$(jq -er .name "$pkg_json")
    if [[ $? -ne 0 || ! $pkg_name ]]; then
        err "failed to parse NPM package name from '$pkg_json'"
        return 1
    fi

    local pkg_url=https://atomist.jfrog.io/atomist/npm-dev/$pkg_name/-/$pkg_name-$pkg_version.tgz
    if ! git-status npm/atomist/prerelease "Pre-release NPM package publication" "$pkg_url"; then
        err "failed to create GitHub commit status for NPM package pre-release"
        return 1
    fi
}

# create a link between a docker image and a commit
# usage: link-image DOCKER_TAG
function link-image () {
    local tag=$1
    if [[ ! $tag ]]; then
        err "link-image: missing required argument: DOCKER_TAG"
        return 10
    fi
    shift

    if [[ ! $ATOMIST_TEAM ]]; then
        msg "no Atomist team set"
        msg "not creating docker image-commit link"
        return 0
    fi
    local url="https://webhook.atomist.com/atomist/link-image/teams/$ATOMIST_TEAM"
    local owner=${TRAVIS_REPO_SLUG%/*}
    local repo=${TRAVIS_REPO_SLUG#*/}
    local sha
    if [[ $TRAVIS_PULL_REQUEST_SHA ]]; then
        sha=$TRAVIS_PULL_REQUEST_SHA
    else
        sha=$TRAVIS_COMMIT
    fi
    local payload
    printf -v payload '{"git":{"owner":"%s","repo":"%s","sha":"%s"},"docker":{"image":"%s"},"type":"link-image"}' "$owner" "$repo" "$sha" "$tag"
    msg "posting image-link payload to '$url': '$payload'"
    if ! curl -s -f -X POST -H "Content-Type: application/json" --data-binary "$payload" "$url" > /dev/null 2>&1
    then
        err "failed to post payload '$payload' to '$url'"
        return 1
    fi
}

# create and push a Docker image
# usage: docker-push IMAGE VERSION
function docker-push () {
    local image_name=$1
    if [[ ! $image_name ]]; then
        err "docker-push: missing required argument: NAME"
        return 10
    fi
    shift
    local image_version=$1
    if [[ ! $image_version ]]; then
        err "docker-push: missing required argument: VERSION"
        return 10
    fi
    shift

    if [[ ! $DOCKER_REGISTRY ]]; then
        msg "no Docker registry set"
        msg "skipping Docker build and push"
        return 0
    fi

    local server=
    if [[ $DOCKER_REGISTRY =~ [^a-zA-Z0-9] ]]; then
        server=$DOCKER_REGISTRY
    fi
    if ! docker login -u "$DOCKER_USER" -p "$DOCKER_PASSWORD" $server; then
        err "failed to login to docker registry: $DOCKER_REGISTRY"
        return 1
    fi

    local tag=$DOCKER_REGISTRY/$image_name:$image_version
    if ! docker build -t "$tag" .; then
        err "failed to build docker image: '$tag'"
        return 1
    fi

    if ! docker push "$tag"; then
        err "failed to push docker image: '$tag'"
        return 1
    fi

    if ! link-image "$tag"; then
        err "failed to create link between commit and Docker image '$tag'"
        return 1
    fi
}

# push app to Cloud Foundry
# usage: cf-push APP [SPACE]
function cf-push () {
    local app=$1
    if [[ ! $app ]]; then
        err "cf-push: missing required argument: APPLICATION"
        return 10
    fi
    shift
    local space=$1
    if [[ ! $space ]]; then
        space=production
    fi

    if [[ ! $CF_ORG ]]; then
        msg "no Cloud Foundry org set"
        msg "skipping Cloud Foundry push"
        return 0
    fi

    local api_url=${CF_API:-https://api.run.pivotal.io}

    if ! cf login -a "$api_url" -u "$CF_USER" -p "$CF_PASSWORD" -o "$CF_ORG" -s "$space"
    then
        err "failed to log in to Cloud Foundry at '$api_url'"
        return 1
    fi

    if ! cf push "$app"; then
        err "failed to push '$app' to Cloud Foundry"
        return 1
    fi
}

# sync build to S3 bucket
# usage: s3-sync BUCKET
function s3-sync () {
    local bucket=$1
    if [[ ! $bucket ]]; then
        err "s3-sync: missing required argument: BUCKET"
        return 10
    fi
    shift

    if ! s3cmd sync --delete-removed public/ "s3://$bucket/"; then
        err "failed to sync public directory to s3 bucket '$bucket'"
        return 1
    fi
}

# usage: main "$@"
function main () {
    local arg ignore_lint
    for arg in "$@"; do
        case "$arg" in
            --ignore-lint | --ignore-lin | --ignore-li | --ignore-l)
                ignore_lint=1
                ;;
            -*)
                err "unknown option: $arg"
                return 2
                ;;
        esac
    done

    msg "running compile"
    if ! npm run compile; then
        err "compilation failed"
        return 1
    fi

    if [[ -d test ]]; then
        msg "running tests"
        if ! npm test; then
            err "test failed"
            return 1
        fi
    fi

    msg "running lint"
    local lint_status
    npm run lint
    lint_status=$?
    if [[ $lint_status -eq 0 ]]; then
        :
    elif [[ $lint_status -eq 2 ]]; then
        err "TypeScript failed to pass linting"
        if [[ $ignore_lint ]]; then
            err "ignoring linting failure"
        else
            return 1
        fi
    else
        err "tslint errored"
        return 1
    fi

    msg "running typedoc"
    if ! npm run typedoc; then
        err "failed to generate TypeDoc"
        return 1
    fi

    [[ $TRAVIS_PULL_REQUEST == false ]] || return 0

    local app=${TRAVIS_REPO_SLUG##*/}
    if [[ $TRAVIS_TAG =~ ^[0-9]+\.[0-9]+\.[0-9]+(-(m|rc)\.[0-9]+)?$ ]]; then
        msg "publishing NPM package version '$TRAVIS_TAG'"
        if ! npm-publish --access public; then
            err "failed to publish tag build: '$TRAVIS_TAG'"
            return 1
        fi
        msg "building and pushing Docker image"
        if ! docker-push "$app" "$TRAVIS_TAG"; then
            err "failed to build and push docker image"
            return 1
        fi
        if [[ $S3_BUCKET_BASE ]]; then
            msg "syncing public directory to S3"
            local bucket=$S3_BUCKET_BASE.atomist.com
            if ! s3-sync "$bucket"; then
                err "failed to sync public directory to S3 bucket '$bucket'"
                return 1
            fi
        fi
        msg "pushing app to Cloud Foundry"
        if ! cf-push "$app"; then
            err "failed to push '$app' to Cloud Foundry"
            return 1
        fi
        if ! git-tag "$TRAVIS_TAG+travis.$TRAVIS_BUILD_NUMBER"; then
            return 1
        fi
    else
        if ! set-timestamp-version "$TRAVIS_BRANCH"; then
            err "failed to set timestamp version"
            return 1
        fi
        local prerelease_version pkg_json=package.json
        prerelease_version=$(jq -er .version "$pkg_json")
        if [[ $? -ne 0 || ! $prerelease_version ]]; then
            err "failed to parse version from $pkg_json: '$prerelease_version'"
            return 1
        fi
        msg "publishing NPM package version '$prerelease_version'"
        if ! npm-publish-prerelease "$prerelease_version"; then
            err "failed to publish version '$prerelease_version'"
            return 1
        fi
        msg "building and pushing Docker image"
        if ! docker-push "$app" "$prerelease_version"; then
            err "failed to build and push docker image for '$app' version '$prerelease_version'"
            return 1
        fi
        if [[ $TRAVIS_BRANCH == master ]]; then
            local staging_app=$app-staging
            if [[ $S3_BUCKET_BASE ]]; then
                msg "syncing public directory to S3"
                local bucket=$S3_BUCKET_BASE-staging.atomist.services
                if ! s3-sync "$bucket"; then
                    err "failed to sync public directory to S3 bucket '$bucket'"
                    return 1
                fi
            fi
            msg "pushing staging app to Cloud Foundry development space"
            if ! cf-push "$staging_app" development; then
                err "failed to push '$staging_app' to Cloud Foundry"
                return 1
            fi
            if ! git-tag "$prerelease_version" "$prerelease_version+travis.$TRAVIS_BUILD_NUMBER"; then
                return 1
            fi
        else
            if ! git-tag "$prerelease_version+travis.$TRAVIS_BUILD_NUMBER"; then
                return 1
            fi
        fi
    fi
}

main "$@" || exit 1
exit 0
