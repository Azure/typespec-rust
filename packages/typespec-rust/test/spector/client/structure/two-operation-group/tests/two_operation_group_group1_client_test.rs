// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_twoop::{models::ClientType, TwoOperationGroupClient};

#[tokio::test]
async fn four() {
    let client = TwoOperationGroupClient::with_no_credential(
        "http://localhost:3000",
        ClientType::TwoOperationGroup,
        None,
    )
    .unwrap();
    client
        .get_two_operation_group_group1_client()
        .four(None)
        .await
        .unwrap();
}

#[tokio::test]
async fn one() {
    let client = TwoOperationGroupClient::with_no_credential(
        "http://localhost:3000",
        ClientType::TwoOperationGroup,
        None,
    )
    .unwrap();
    client
        .get_two_operation_group_group1_client()
        .one(None)
        .await
        .unwrap();
}

#[tokio::test]
async fn three() {
    let client = TwoOperationGroupClient::with_no_credential(
        "http://localhost:3000",
        ClientType::TwoOperationGroup,
        None,
    )
    .unwrap();
    client
        .get_two_operation_group_group1_client()
        .three(None)
        .await
        .unwrap();
}
