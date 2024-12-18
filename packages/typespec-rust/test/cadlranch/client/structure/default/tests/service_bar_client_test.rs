// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use cadl_default::{models::ClientType, ServiceClient};

#[async_std::test]
async fn five() {
    let client =
        ServiceClient::with_no_credential("http://localhost:3000", ClientType::Default, None)
            .unwrap();
    client.get_service_bar_client().five(None).await.unwrap();
}

#[async_std::test]
async fn six() {
    let client =
        ServiceClient::with_no_credential("http://localhost:3000", ClientType::Default, None)
            .unwrap();
    client.get_service_bar_client().six(None).await.unwrap();
}
