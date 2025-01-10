// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { execSync } from 'child_process';
import * as fs from 'fs';

const workspaceRoot = execSync('git rev-parse --show-toplevel').toString().trim() + '/packages/typespec-rust/test';

const entries = fs.readdirSync(workspaceRoot, { recursive: true, withFileTypes: true });

entries.forEach((entry) => {
    if (entry.isFile() && entry.name === 'Cargo.toml' && entry.parentPath !== workspaceRoot) {
        console.log(`    "${entry.parentPath.substring(workspaceRoot.length + 1).replaceAll('\\', '/')}",`);
    }
});
