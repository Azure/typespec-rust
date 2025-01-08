// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_renamedop::{models::ClientType, RenamedOperationClient};

#[tokio::test]
async fn renamed_four() {
    let client = RenamedOperationClient::with_no_credential(
        "http://localhost:3000",
        ClientType::RenamedOperation,
        None,
    )
    .unwrap();
    client
        .get_renamed_operation_group_client()
        .renamed_four(None)
        .await
        .unwrap();
}

#[tokio::test]
async fn renamed_six() {
    let client = RenamedOperationClient::with_no_credential(
        "http://localhost:3000",
        ClientType::RenamedOperation,
        None,
    )
    .unwrap();
    client
        .get_renamed_operation_group_client()
        .renamed_six(None)
        .await
        .unwrap();
}

#[tokio::test]
async fn renamed_two() {
    let client = RenamedOperationClient::with_no_credential(
        "http://localhost:3000",
        ClientType::RenamedOperation,
        None,
    )
    .unwrap();
    client
        .get_renamed_operation_group_client()
        .renamed_two(None)
        .await
        .unwrap();
}
