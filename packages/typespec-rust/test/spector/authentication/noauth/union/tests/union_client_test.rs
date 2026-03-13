// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::credentials::{AccessToken, TokenCredential, TokenRequestOptions};
use azure_core::time::OffsetDateTime;
use azure_core::Result;
use spector_noauth::UnionClient;
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
        _options: Option<TokenRequestOptions<'_>>,
    ) -> Result<AccessToken> {
        Ok(AccessToken::new(
            self.token.clone(),
            OffsetDateTime::now_utc(),
        ))
    }
}

#[tokio::test]
async fn client_endpoint_is_stored() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    assert_eq!(client.endpoint().as_str(), "http://localhost:3000/");
}

#[tokio::test]
async fn client_rejects_malformed_url() {
    let result = UnionClient::with_no_credential("not-a-valid-url", None);
    assert!(result.is_err(), "malformed URL should be rejected");
}

#[tokio::test]
async fn client_rejects_non_http_scheme() {
    let result = UnionClient::with_no_credential("ftp://localhost:3000", None);
    assert!(result.is_err(), "non-http scheme should be rejected");
}

#[tokio::test]
async fn valid_no_auth_returns_204() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client.valid_no_auth(None).await.unwrap();
    assert_eq!(
        resp.status(),
        204,
        "valid_no_auth should return 204 No Content"
    );
}

#[tokio::test]
async fn valid_token_returns_204() {
    let client = UnionClient::new(
        "http://localhost:3000",
        Arc::new(FakeTokenCredential::new(
            "https://security.microsoft.com/.default".to_string(),
        )),
        None,
    )
    .unwrap();
    let resp = client.valid_token(None).await.unwrap();
    assert_eq!(
        resp.status(),
        204,
        "valid_token should return 204 No Content"
    );
}
