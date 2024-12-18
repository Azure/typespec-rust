// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use cadl_clientopgroup::{models::ClientType, FirstClient};

#[async_std::test]
async fn four() {
    let client = FirstClient::with_no_credential(
        "http://localhost:3000",
        ClientType::ClientOperationGroup,
        None,
    )
    .unwrap();
    client.get_first_group4_client().four(None).await.unwrap();
}
