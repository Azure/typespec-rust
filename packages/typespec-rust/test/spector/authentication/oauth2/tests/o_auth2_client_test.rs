// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::credentials::{AccessToken, TokenCredential, TokenRequestOptions};
use azure_core::date::OffsetDateTime;
use azure_core::Result;
use spector_oauth2::OAuth2Client;
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
async fn invalid() {
    let client = OAuth2Client::new(
        "http://localhost:3000",
        Arc::new(FakeTokenCredential::new("invalid_token".to_string())),
        None,
    )
    .unwrap();
    let resp = client.invalid(None).await;
    resp.expect_err("server returned error status which will not be retried: 403");
}

#[tokio::test]
async fn valid() {
    let client = OAuth2Client::new(
        "http://localhost:3000",
        Arc::new(FakeTokenCredential::new(
            "https://security.microsoft.com/.default".to_string(),
        )),
        None,
    )
    .unwrap();
    client.valid(None).await.unwrap();
}
