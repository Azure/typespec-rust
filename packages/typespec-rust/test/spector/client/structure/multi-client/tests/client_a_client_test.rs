// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_multiclient::{models::ClientType, ClientAClient};

#[tokio::test]
async fn renamed_five() {
    let client =
        ClientAClient::with_no_credential("http://localhost:3000", ClientType::MultiClient, None)
            .unwrap();
    client.renamed_five(None).await.unwrap();
}

#[tokio::test]
async fn renamed_one() {
    let client =
        ClientAClient::with_no_credential("http://localhost:3000", ClientType::MultiClient, None)
            .unwrap();
    client.renamed_one(None).await.unwrap();
}

#[tokio::test]
async fn renamed_three() {
    let client =
        ClientAClient::with_no_credential("http://localhost:3000", ClientType::MultiClient, None)
            .unwrap();
    client.renamed_three(None).await.unwrap();
}
