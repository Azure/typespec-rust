// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_multi_service::CombinedClient;

#[tokio::test]
async fn service_a_foo_test() {
    let client =
        CombinedClient::with_no_credential("http://localhost:3000", "av2".to_string(), None)
            .unwrap();
    let foo_client = client.get_combined_foo_client();
    foo_client.test(None).await.unwrap();
}

#[tokio::test]
async fn service_b_bar_test() {
    let client =
        CombinedClient::with_no_credential("http://localhost:3000", "bv2".to_string(), None)
            .unwrap();
    let bar_client = client.get_combined_bar_client();
    bar_client.test(None).await.unwrap();
}
