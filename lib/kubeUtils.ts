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

import {
    decryptSecret,
    encryptSecret,
} from "@atomist/sdm-pack-k8s";
import * as k8s from "@kubernetes/client-node";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import { DeepPartial } from "ts-essentials";
import { KubeCryptOptions } from "./kubeCrypt";
import * as print from "./print";

/**
 * Does the requested encryption/decryption of the provided secret
 * @param input the secret to encrypt/decrypt
 * @param key the secret key to encrypt/decrypt with
 * @return the encrypted/decrypted secret
 */
export async function crypt(input: DeepPartial<k8s.V1Secret>,
                            opts: Pick<KubeCryptOptions, "action" | "secretKey">): Promise<DeepPartial<k8s.V1Secret>> {

    let secret: DeepPartial<k8s.V1Secret>;
    if (opts.action === "encrypt") {
        secret = await encryptSecret(input, opts.secretKey);
    } else {
        secret = await decryptSecret(input, opts.secretKey);
    }

    return secret;
}

/**
 * Encodes or decodes the data section of a secret
 * @param secret The secret to encode/decode
 * @param action encode or decode
 */
export function base64(secret: DeepPartial<k8s.V1Secret>, action: "encode" | "decode"): DeepPartial<k8s.V1Secret> {
    for (const datum of Object.keys(secret.data)) {
        const encoding = action === "encode" ?
            Buffer.from(secret.data[datum]).toString("base64") : Buffer.from(secret.data[datum], "base64").toString();
        secret.data[datum] = encoding;
    }
    return secret;
}

/**
 * prints the secret to the output
 * @param secret the secret to print
 * @param opts literal or file from KubeCryptOptions
 */
export function printSecret(secret: DeepPartial<k8s.V1Secret>, opts: Pick<KubeCryptOptions, "literal" | "file">): void {
    if (opts.literal) {
        print.log(secret.data[opts.literal]);
    } else if (/\.ya?ml$/.test(opts.file)) {
        print.log(yaml.safeDump(secret));
    } else {
        print.log(JSON.stringify(secret, undefined, 2));
    }
}

/**
 * writes the secret to file
 * @param secret the secret to write
 * @param opts file from KubeCryptOptions
 */
export async function writeSecret(secret: DeepPartial<k8s.V1Secret>, opts: Pick<KubeCryptOptions, "file">): Promise<void> {
    const dumpString = /\.ya?ml$/.test(opts.file) ? yaml.safeDump(secret) : JSON.stringify(secret, undefined, 2);
    await fs.writeFile(opts.file, dumpString);
}
