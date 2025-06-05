// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::{
    credentials::{AccessToken, TokenCredential, TokenRequestOptions},
    date::OffsetDateTime,
    Result,
};
use spector_armnonresource::{models::NonResource, NonResourceClient};
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
    async fn get_token(
        &self,
        _scopes: &[&str],
        _options: Option<TokenRequestOptions>,
    ) -> Result<AccessToken> {
        Ok(AccessToken::new(
            self.token.clone(),
            OffsetDateTime::now_utc(),
        ))
    }
}

#[tokio::test]
async fn create() {
    let client = NonResourceClient::new(
        "http://localhost:3000",
        Arc::new(FakeTokenCredential::new("fake_token".to_string())),
        "00000000-0000-0000-0000-000000000000".to_string(),
        None,
    )
    .unwrap();
    let body = NonResource {
        id: Some("id".to_string()),
        name: Some("hello".to_string()),
        type_prop: Some("nonResource".to_string()),
    };
    let resp = client
        .get_non_resource_non_resource_operations_client()
        .create("eastus", "hello", body.try_into().unwrap(), None)
        .await
        .unwrap()
        .into_body()
        .await
        .unwrap();
    assert_eq!(resp.id, Some("id".to_string()));
    assert_eq!(resp.name, Some("hello".to_string()));
    assert_eq!(resp.type_prop, Some("nonResource".to_string()));
}

#[tokio::test]
async fn get() {
    let client = NonResourceClient::new(
        "http://localhost:3000",
        Arc::new(FakeTokenCredential::new("fake_token".to_string())),
        "00000000-0000-0000-0000-000000000000".to_string(),
        None,
    )
    .unwrap();
    let resp = client
        .get_non_resource_non_resource_operations_client()
        .get("eastus", "hello", None)
        .await
        .unwrap()
        .into_body()
        .await
        .unwrap();
    assert_eq!(resp.id, Some("id".to_string()));
    assert_eq!(resp.name, Some("hello".to_string()));
    assert_eq!(resp.type_prop, Some("nonResource".to_string()));
}
