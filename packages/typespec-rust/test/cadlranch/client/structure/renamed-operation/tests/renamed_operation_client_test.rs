// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use cadl_renamedop::{models::ClientType, RenamedOperationClient};

#[async_std::test]
async fn renamed_five() {
    let client = RenamedOperationClient::with_no_credential(
        "http://localhost:3000",
        ClientType::RenamedOperation,
        None,
    )
    .unwrap();
    client.renamed_five(None).await.unwrap();
}

#[async_std::test]
async fn renamed_one() {
    let client = RenamedOperationClient::with_no_credential(
        "http://localhost:3000",
        ClientType::RenamedOperation,
        None,
    )
    .unwrap();
    client.renamed_one(None).await.unwrap();
}

#[async_std::test]
async fn renamed_three() {
    let client = RenamedOperationClient::with_no_credential(
        "http://localhost:3000",
        ClientType::RenamedOperation,
        None,
    )
    .unwrap();
    client.renamed_three(None).await.unwrap();
}
