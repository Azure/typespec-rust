// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::credentials::{AccessToken, TokenCredential, TokenRequestOptions};
use azure_core::http::ClientOptions;
use azure_core::time::OffsetDateTime;
use azure_core::Result;
use spector_unionauth::{KeyCredential, UnionClient, UnionClientOptions};
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

#[tokio::test]
async fn valid_key() {
    let client = UnionClient::with_key_credential(
        "http://localhost:3000",
        KeyCredential::new("valid-key".to_string()),
        None,
    )
    .unwrap();
    client.valid_key(None).await.unwrap();
}

#[tokio::test]
async fn valid_token() {
    let credential = Arc::new(FakeTokenCredential::new(
        "https://security.microsoft.com/.default".to_string(),
    ));
    let client = UnionClient::new(
        "http://localhost:3000",
        credential.clone(),
        Some(UnionClientOptions {
            client_options: ClientOptions {
                per_call_policies: vec![Arc::new(spector_policy::SpectorPolicy::with_credential(
                    credential,
                ))],
                ..Default::default()
            },
        }),
    )
    .unwrap();
    client.valid_token(None).await.unwrap();
}
