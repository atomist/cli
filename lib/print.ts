/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { LoggingConfig } from "@atomist/automation-client/internal/util/logger";
LoggingConfig.format = "cli";

/** CLI package */
const pkg = "atomist";

/* tslint:disable:no-console */

/**
 * Print error message to stderr.
 * @param msg message to print
 */
export function error(msg: string): void {
    console.error(`${pkg}: [ERROR] ${msg}`);
}

/**
 * Print informational message to stdout.
 * @param msg message to print
 */
export function info(msg: string): void {
    console.info(`${pkg}: [INFO] ${msg}`);
}

/**
 * Print message to stdout.
 * @param msg message to print
 */
export function log(msg: string): void {
    console.log(msg);
}

/**
 * Print warning message to stdout.
 * @param msg message to print
 */
export function warn(msg: string): void {
    console.warn(`${pkg}: [WARN] ${msg}`);
}
