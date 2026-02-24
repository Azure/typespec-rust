// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use spector_azure_client_namespace::ClientNamespaceFirstClient;

#[tokio::test]
async fn client_namespace_first() {
    let client =
        ClientNamespaceFirstClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client.get_first(None).await.unwrap();
    let result = resp.into_model().unwrap();
    assert_eq!(result.name, Some("first".to_string()));
}
