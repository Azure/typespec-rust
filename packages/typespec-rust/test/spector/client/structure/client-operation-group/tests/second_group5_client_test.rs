// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_clientopgroup::{models::ClientType, SecondClient};

#[tokio::test]
async fn six() {
    let client = SecondClient::with_no_credential(
        "http://localhost:3000",
        ClientType::ClientOperationGroup,
        None,
    )
    .unwrap();
    client.get_second_group5_client().six(None).await.unwrap();
}
