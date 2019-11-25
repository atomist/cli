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

import * as k8s from "@kubernetes/client-node";
import * as fs from "fs-extra";
import * as inquirer from "inquirer";
import * as yaml from "js-yaml";
import * as _ from "lodash";
import { DeepPartial } from "ts-essentials";
import { maskString } from "./config";
import {
    base64,
    crypt,
    printSecret,
} from "./kubeUtils";
import * as print from "./print";

/**
 * Command-line options and arguments for kube-decrypt and kube-encrypt.
 */
export interface KubeCryptOptions {
    /** To encrypt or decrypt? */
    action: KubeCryptActions;
    /** Path to Kubernetes secret spec file. */
    file?: string;
    /** Literal string to encrypt/decrypt. */
    literal?: string;
    /** Encryption key to use for encryption/decryption. */
    secretKey?: string;
    /** Option to Base64 encode/decode data */
    base64?: boolean;
}

/** Action to perform */
export type KubeCryptActions = "decrypt" | "encrypt";

/**
 * Encrypt or decrypt secret data values.
 *
 * @param opts see KubeCryptOptions
 * @return integer return value, 0 if successful, non-zero otherwise
 */
export async function kubeCrypt(opts: KubeCryptOptions): Promise<number> {
    let secret: DeepPartial<k8s.V1Secret>;

    secret = await handleSecretParameter(opts);
    if (!secret) {
        return 2;
    }
    opts.secretKey = await handleSecretKeyParameter(opts);

    const base64Encode = (s: DeepPartial<k8s.V1Secret>) => opts.base64 ? base64(s, "encode") : s;
    const base64Decode = (s: DeepPartial<k8s.V1Secret>) => opts.base64 ? base64(s, "decode") : s;

    try {
        let transformed: DeepPartial<k8s.V1Secret>;
        if (opts.action === "encrypt") {
            transformed = await crypt(base64Encode(secret), opts);
        } else {
            transformed = base64Decode(await crypt(secret, opts));
        }
        printSecret(transformed, opts);
    } catch (e) {
        print.error(`Failed to ${opts.action} secret: ${e.message}`);
        return 3;
    }

    return 0;
}

/**
 * Handle the literal or file secret parameter from the cli
 * @param opts file or literal of KubeCryptOptions
 * @returns secret or undefined if the file cannot be loaded
 */
export async function handleSecretParameter(opts: Pick<KubeCryptOptions, "file" | "literal" | "action">): Promise<DeepPartial<k8s.V1Secret>> {
    let secret: DeepPartial<k8s.V1Secret>;
    if (opts.file) {
        try {
            const secretString = await fs.readFile(opts.file, "utf8");
            secret = await yaml.safeLoad(secretString);
        } catch (e) {
            print.error(`Failed to load secret spec from '${opts.file}'`);
            return undefined;
        }
    } else {
        if (!opts.literal) {
            const answers = await inquirer.prompt<Record<string, string>>([{
                type: "input",
                name: "literal",
                message: `Enter literal string to be ${opts.action}ed:`,
            }]);
            opts.literal = answers.literal;
        }
        secret = wrapLiteral(opts.literal, opts.literal);
    }
    return secret;
}

/**
 *  Creates a k8s.V1Secret with the input in the data section.
 * @param prop property name
 * @param literal String to wrap in k8s.V1Secret
 * @returns the k8s.V1Secret
 */
export function wrapLiteral(prop: string, literal: string): DeepPartial<k8s.V1Secret> {
    const secret: DeepPartial<k8s.V1Secret> = {
        apiVersion: "v1",
        data: {},
        kind: "Secret",
        type: "Opaque",
    };
    secret.data[prop] = literal;
    return secret;
}

/**
 * Handle the secret key parameter from the cli
 * @param opts secretKey from KubeCryptOptions
 * @returns the secret
 */
export async function handleSecretKeyParameter(opts: Pick<KubeCryptOptions, "secretKey">): Promise<string> {
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
    return opts.secretKey;
}
