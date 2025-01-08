// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_unversioned::NotVersionedClient;

#[tokio::test]
async fn with_path_api_version() {
    let client = NotVersionedClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .with_path_api_version("v1.0".to_string(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_query_api_version() {
    let client = NotVersionedClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .with_query_api_version("v1.0".to_string(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn without_api_version() {
    let client = NotVersionedClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.without_api_version(None).await.unwrap();
}
