/*
 * Copyright © 2019 Atomist, Inc.
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

import { guid } from "@atomist/automation-client";
import {
    decryptSecret,
    encryptSecret,
} from "@atomist/sdm-pack-k8s";
import * as k8s from "@kubernetes/client-node";
import * as fs from "fs-extra";
import * as inquirer from "inquirer";
import * as yaml from "js-yaml";
import { DeepPartial } from "ts-essentials";
import { maskString } from "./config";
import * as print from "./print";

/**
 * Command-line options and arguments for kube-decrypt and kube-encrypt.
 */
export interface KubeCryptOptions {
    /** To encrypt or decrypt? */
    action: "decrypt" | "encrypt";
    /** Path to Kubernetes secret spec file. */
    file?: string;
    /** Literal string to encrypt/decrypt. */
    literal?: string;
    /** Encryption key to use for encryption/decryption. */
    secretKey?: string;
}

/**
 * Encrypt or decrypt secret data values.
 *
 * @param opts see KubeCryptOptions
 * @return integer return value, 0 if successful, non-zero otherwise
 */
export async function kubeCrypt(opts: KubeCryptOptions): Promise<number> {
    let secret: DeepPartial<k8s.V1Secret>;
    const literalProp = `literal-${guid()}`;
    if (opts.literal) {
        secret = wrapLiteral(opts.literal, literalProp);
    } else if (opts.file) {
        try {
            const secretString = await fs.readFile(opts.file, "utf8");
            secret = await yaml.safeLoad(secretString);
        } catch (e) {
            print.error(`Failed to load secret spec from file '${opts.file}': ${e.message}`);
            return 2;
        }
    } else {
        const answers = await inquirer.prompt<Record<string, string>>([{
            type: "input",
            name: "literal",
            message: `Enter literal string to be ${opts.action}ed:`,
        }]);
        secret = wrapLiteral(answers.literal, literalProp);
    }

    if (!opts.secretKey) {
        const answers = await inquirer.prompt<Record<string, string>>([{
            type: "input",
            name: "secretKey",
            message: `Enter encryption key:`,
            transformer: maskString,
            validate: v => v.length < 1 ? "Secret key must have non-zero length" : true,
        }]);
        opts.secretKey = answers.secretKey;
    }

    const action = (opts.action === "decrypt") ? decryptSecret : encryptSecret;

    try {
        const transformed = await action(secret, opts.secretKey);
        if (transformed.data[literalProp]) {
            print.log(transformed.data[literalProp]);
        } else if (/\.ya?ml$/.test(opts.file)) {
            print.log(yaml.safeDump(transformed));
        } else {
            print.log(JSON.stringify(transformed, undefined, 2));
        }
    } catch (e) {
        print.error(`Failed to ${opts.action} secret: ${e.message}`);
        return 3;
    }

    return 0;
}

function wrapLiteral(literal: string, prop: string): DeepPartial<k8s.V1Secret> {
    const secret: DeepPartial<k8s.V1Secret> = {
        apiVersion: "v1",
        data: {},
        kind: "Secret",
        type: "Opaque",
    };
    secret.data[prop] = literal;
    return secret;
}
