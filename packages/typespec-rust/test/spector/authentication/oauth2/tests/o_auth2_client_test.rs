// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::credentials::{AccessToken, TokenCredential, TokenRequestOptions};
use azure_core::http::{ClientOptions, StatusCode};
use azure_core::time::OffsetDateTime;
use azure_core::Result;
use spector_oauth2::{OAuth2Client, OAuth2ClientOptions};
use std::sync::Arc;

#[path = "../../../azure/resource-manager/spector_policy.rs"]
mod spector_policy;

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
        _options: Option<TokenRequestOptions<'_>>,
    ) -> Result<AccessToken> {
        Ok(AccessToken::new(
            self.token.clone(),
            OffsetDateTime::now_utc(),
        ))
    }
}

fn create_client(token: &str) -> OAuth2Client {
    let credential = Arc::new(FakeTokenCredential::new(token.to_string()));
    OAuth2Client::new(
        "http://localhost:3000",
        credential.clone(),
        Some(OAuth2ClientOptions {
            client_options: ClientOptions {
                per_call_policies: vec![Arc::new(spector_policy::SpectorPolicy::with_credential(
                    credential,
                ))],
                ..Default::default()
            },
        }),
    )
    .unwrap()
}

#[tokio::test]
async fn invalid() {
    let client = create_client("invalid_token");
    let err = client.invalid(None).await.expect_err("expected a 403");
    assert_eq!(err.http_status(), Some(StatusCode::Forbidden));
}

#[tokio::test]
async fn valid() {
    let client = create_client("https://security.microsoft.com/.default");
    client.valid(None).await.unwrap();
}
