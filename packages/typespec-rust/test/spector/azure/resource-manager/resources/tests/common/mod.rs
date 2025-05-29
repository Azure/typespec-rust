// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::credentials::{AccessToken, TokenCredential};
use azure_core::date::OffsetDateTime;
use azure_core::Result;
use spector_armresources::ResourcesClient;
use std::sync::Arc;

#[derive(Debug)]
pub struct FakeTokenCredential {
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

pub fn create_client() -> ResourcesClient {
    ResourcesClient::new(
        "http://localhost:3000",
        Arc::new(FakeTokenCredential::new("fake_token".to_string())),
        "00000000-0000-0000-0000-000000000000".to_string(),
        None,
    )
    .unwrap()
}
