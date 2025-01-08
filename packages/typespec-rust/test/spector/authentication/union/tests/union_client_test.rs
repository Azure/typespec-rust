// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::credentials::{AccessToken, TokenCredential};
use azure_core::date::OffsetDateTime;
use azure_core::Result;
use spector_unionauth::UnionClient;
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

    async fn clear_cache(&self) -> Result<()> {
        Ok(())
    }
}

#[async_std::test]
async fn valid_token() {
    let client = UnionClient::new(
        "http://localhost:3000",
        Arc::new(FakeTokenCredential::new(
            "https://security.microsoft.com/.default".to_string(),
        )),
        None,
    )
    .unwrap();
    client.valid_token(None).await.unwrap();
}
