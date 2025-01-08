// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_multiclient::{models::ClientType, ClientBClient};

#[async_std::test]
async fn renamed_four() {
    let client =
        ClientBClient::with_no_credential("http://localhost:3000", ClientType::MultiClient, None)
            .unwrap();
    client.renamed_four(None).await.unwrap();
}

#[async_std::test]
async fn renamed_six() {
    let client =
        ClientBClient::with_no_credential("http://localhost:3000", ClientType::MultiClient, None)
            .unwrap();
    client.renamed_six(None).await.unwrap();
}

#[async_std::test]
async fn renamed_two() {
    let client =
        ClientBClient::with_no_credential("http://localhost:3000", ClientType::MultiClient, None)
            .unwrap();
    client.renamed_two(None).await.unwrap();
}
