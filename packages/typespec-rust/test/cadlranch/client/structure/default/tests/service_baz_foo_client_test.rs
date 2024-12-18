// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use cadl_default::{models::ClientType, ServiceClient};

#[async_std::test]
async fn seven() {
    let client =
        ServiceClient::with_no_credential("http://localhost:3000", ClientType::Default, None)
            .unwrap();
    client
        .get_service_baz_client()
        .get_service_baz_foo_client()
        .seven(None)
        .await
        .unwrap();
}
