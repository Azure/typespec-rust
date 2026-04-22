// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::cloud::{CloudConfiguration, CustomConfiguration};
use azure_core::credentials::{AccessToken, TokenCredential, TokenRequestOptions};
use azure_core::http::ClientOptions;
use azure_core::time::OffsetDateTime;
use azure_core::Result;
use spector_armmethodsub::{MethodSubscriptionIdClient, MethodSubscriptionIdClientOptions};
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

pub fn create_client() -> MethodSubscriptionIdClient {
    let mut custom = CustomConfiguration::default();
    custom.authority_host = "http://localhost:3000".to_string();
    MethodSubscriptionIdClient::new(
        Arc::new(FakeTokenCredential::new("fake_token".to_string())),
        "00000000-0000-0000-0000-000000000000".to_string(),
        Some(MethodSubscriptionIdClientOptions {
            client_options: ClientOptions {
                cloud: Some(Arc::new(CloudConfiguration::Custom(custom))),
                ..Default::default()
            },
            ..Default::default()
        }),
    )
    .unwrap()
}
