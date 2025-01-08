// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_twoop::{models::ClientType, TwoOperationGroupClient};

#[tokio::test]
async fn five() {
    let client = TwoOperationGroupClient::with_no_credential(
        "http://localhost:3000",
        ClientType::TwoOperationGroup,
        None,
    )
    .unwrap();
    client
        .get_two_operation_group_group2_client()
        .five(None)
        .await
        .unwrap();
}

#[tokio::test]
async fn six() {
    let client = TwoOperationGroupClient::with_no_credential(
        "http://localhost:3000",
        ClientType::TwoOperationGroup,
        None,
    )
    .unwrap();
    client
        .get_two_operation_group_group2_client()
        .six(None)
        .await
        .unwrap();
}

#[tokio::test]
async fn two() {
    let client = TwoOperationGroupClient::with_no_credential(
        "http://localhost:3000",
        ClientType::TwoOperationGroup,
        None,
    )
    .unwrap();
    client
        .get_two_operation_group_group2_client()
        .two(None)
        .await
        .unwrap();
}
