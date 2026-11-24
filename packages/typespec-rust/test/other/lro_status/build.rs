// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use std::{env, fs, path::PathBuf};

fn main() {
    let path = "src/generated/models/models_impl.rs";
    println!("cargo:rerun-if-changed={path}");
    let source = fs::read_to_string(path).unwrap();
    // Compile the actual private decoders in the integration test without exporting them.
    let decoders = source
        .split("/// Borrows ordinary status strings")
        .find(|block| {
            block.split("\nimpl ").next().unwrap().contains(
                "struct LroStatusTestSnapshotsClientBeginOptionalStatusOperationStatusStatusValue",
            )
        })
        .unwrap()
        .split("\nimpl ")
        .next()
        .unwrap();
    fs::write(
        PathBuf::from(env::var_os("OUT_DIR").unwrap()).join("status_decoders.rs"),
        format!("/// Borrows ordinary status strings{decoders}"),
    )
    .unwrap();
}
