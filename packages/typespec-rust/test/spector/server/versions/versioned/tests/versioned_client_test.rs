// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_versioned::{versioned_client::VersionedClientOptions, VersionedClient};

#[tokio::test]
async fn with_path_api_version() {
    let client = VersionedClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.with_path_api_version(None).await.unwrap();
}

#[tokio::test]
async fn with_query_api_version() {
    let client = VersionedClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.with_query_api_version(None).await.unwrap();
}

#[tokio::test]
async fn with_query_old_api_version() {
    let client = VersionedClient::with_no_credential(
        "http://localhost:3000",
        Some(VersionedClientOptions {
            api_version: "2021-01-01-preview".to_string(),
            ..Default::default()
        }),
    )
    .unwrap();
    client.with_query_old_api_version(None).await.unwrap();
}

#[tokio::test]
async fn without_api_version() {
    let client = VersionedClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.without_api_version(None).await.unwrap();
}
