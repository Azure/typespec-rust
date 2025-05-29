// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::credentials::{AccessToken, TokenCredential};
use azure_core::date::OffsetDateTime;
use azure_core::Result;
use spector_armresources::ResourcesClient;
use std::sync::Arc;

#[derive(Debug)]
struct FakeTokenCredential {
    pub token: String,
}

impl FakeTokenCredential {
    pub fn new(token: String) -> Self {
        FakeTokenCredential { token }
    }
}

#[async_trait::async_trait]
impl TokenCredential for FakeTokenCredential {
    async fn get_token(&self, _scopes: &[&str]) -> Result<AccessToken> {
        Ok(AccessToken::new(
            self.token.clone(),
            OffsetDateTime::now_utc(),
        ))
    }
}

#[tokio::test]
async fn create_resources_client() {
    // Test client creation with default options
    let client = ResourcesClient::new(
        "http://localhost:3000",
        Arc::new(FakeTokenCredential::new("fake_token".to_string())),
        "00000000-0000-0000-0000-000000000000".to_string(),
        None,
    )
    .unwrap();

    // Verify the endpoint URL
    assert_eq!(client.endpoint().as_str(), "http://localhost:3000/");

    // Test accessing the sub-clients
    let _top_level_client = client.get_resources_top_level_client();
    let _nested_client = client.get_resources_nested_client();
    let _singleton_client = client.get_resources_singleton_client();
    let _location_resources_client = client.get_resources_location_resources_client();
    let _extensions_resources_client = client.get_resources_extensions_resources_client();
}

#[tokio::test]
async fn create_resources_client_with_invalid_url() {
    // Test client creation with invalid URL
    let client_result = ResourcesClient::new(
        "invalid-url",
        Arc::new(FakeTokenCredential::new("fake_token".to_string())),
        "00000000-0000-0000-0000-000000000000".to_string(),
        None,
    );

    // Verify that the client creation fails with an error
    assert!(client_result.is_err());
}

#[tokio::test]
async fn create_resources_client_with_custom_options() {
    // Test client creation with custom options
    let options = spector_armresources::ResourcesClientOptions {
        api_version: "2023-05-15".to_string(),
        client_options: azure_core::http::ClientOptions::default(),
    };

    let client = ResourcesClient::new(
        "http://localhost:3000",
        Arc::new(FakeTokenCredential::new("fake_token".to_string())),
        "00000000-0000-0000-0000-000000000000".to_string(),
        Some(options),
    )
    .unwrap();

    // Verify the endpoint URL
    assert_eq!(client.endpoint().as_str(), "http://localhost:3000/");
}
