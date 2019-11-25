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
import { edit } from "external-editor";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import * as _ from "lodash";
import { DeepPartial } from "ts-essentials";
import {
    KubeCryptActions,
    KubeCryptOptions,
} from "./kubeCrypt";
import {
    base64,
    crypt,
    writeSecret,
} from "./kubeUtils";
import * as print from "./print";

type kubeEditOptions = Pick<KubeCryptOptions, "file" | "secretKey">;

export async function kubeEdit(opts: kubeEditOptions): Promise<number> {
    let secret: DeepPartial<k8s.V1Secret>;
    try {
        const secretString = await fs.readFile(opts.file, "utf8");
        secret = await yaml.safeLoad(secretString);
    } catch (e) {
        print.error(`Failed to load secret spec from file '${opts.file}': ${e.message}`);
        return 2;
    }

    try {
        if (opts.secretKey) {
            secret = await crypt(secret, crypAction(opts, "decrypt"));
        }
    } catch (e) {
        print.error(`Failed to decrypt secret: ${e.message}`);
        return 3;
    }
    secret = base64(secret, "decode");

    try {
        secret = await editSecret(secret);
    } catch (e) {
        print.error(`Edit cancelled, ${e.message}`);
        return 4;
    }

    secret = base64(secret, "encode");
    try {
        if (opts.secretKey) {
            secret = await crypt(secret, crypAction(opts, "encrypt"));
        }
    } catch (e) {
        print.error(`Failed to encrpyt secret: ${e.message}`);
        return 3;
    }

    try {
        await writeSecret(secret, opts);
    } catch (e) {
        print.error(`Failed to write secret to file: ${e.message}`);
        return 5;
    }

    return 0;
}

/**
 * Opens the secret in the editor and validates that the resulting secret is valid yaml.
 * If the secret is not valid the editor is reopened.
 * @param inputSecret the secret to be edited
 * @returns the secret after the user has edited it in the editor
 */
async function editSecret(inputSecret: DeepPartial<k8s.V1Secret>): Promise<DeepPartial<k8s.V1Secret>> {
    const comment =
        `# Please edit the secret below. Lines beginning with a '#' will be ignored.
# An empty file will abort the edit.
# If an error occurs while saving the editor will be reopened with the relevant failures.
#\n`;

    let errorMessage = "";
    let outputSecret = _.cloneDeep(inputSecret);
    let secretText = yaml.safeDump(outputSecret);
    do {
        // join everything together to present it to the user
        secretText = comment + errorMessage + secretText;

        secretText = edit(secretText);
        // remove all lines that start with comments
        secretText = secretText.replace(/^#.*\n?/gm, "");
        if (!secretText.trim()) {
            throw new Error("file is empty");
        }

        try {
            outputSecret = await yaml.safeLoad(secretText);
            errorMessage = "";
        } catch (e) {
            errorMessage = `# ${e.message.replace(/\n/gm, "\n# ")} \n`;
        }
    } while (errorMessage);

    return outputSecret;
}

function crypAction(opts: kubeEditOptions, KubeCryptAction: KubeCryptActions): KubeCryptOptions {
    return { ...opts, action: KubeCryptAction };
}
