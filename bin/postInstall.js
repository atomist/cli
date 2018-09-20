#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const automation_client_1 = require("@atomist/automation-client");
const fs = require("fs-extra");
function printErr(e) {
    process.stderr.write(`@atomist/cli:postInstall [ERROR] ${e.message}\n`);
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const banner = `┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   @atomist/cli is now installed.                                         │
│                                                                          │
│   Head to the SDM repo (https://github.com/atomist/sdm) for more info.   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

`;
            // show an informative and friendly welcome message
            if (!fs.existsSync(automation_client_1.userConfigPath())) {
                process.stdout.write(banner);
            }
        }
        catch (e) {
            printErr(e);
        }
    });
}
// we do not want any postInstall failure to cause install to fail
main()
    .catch(e => {
    printErr(e);
})
    .then(() => process.exit(0), e => process.exit(0));
//# sourceMappingURL=postInstall.js.map