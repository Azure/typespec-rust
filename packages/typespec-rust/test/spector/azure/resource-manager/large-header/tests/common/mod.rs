// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::cloud::{Audiences, CloudConfiguration, CustomConfiguration};
use azure_core::credentials::{AccessToken, TokenCredential, TokenRequestOptions};
use azure_core::http::ClientOptions;
use azure_core::time::OffsetDateTime;
use azure_core::Result;
use spector_armlargeheader::{Audience, LargeHeaderClient, LargeHeaderClientOptions};
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

pub fn create_client() -> LargeHeaderClient {
    let mut custom_cloud_config = CustomConfiguration::default();
    custom_cloud_config.authority_host = "http://localhost:3000".to_string();
    custom_cloud_config.audiences =
        Audiences::new().with::<Audience>("http://localhost:3000/.default".to_string());

    LargeHeaderClient::new(
        Arc::new(FakeTokenCredential::new("fake_token".to_string())),
        "00000000-0000-0000-0000-000000000000".to_string(),
        Some(LargeHeaderClientOptions {
            client_options: ClientOptions {
                cloud: Some(Arc::new(CloudConfiguration::Custom(custom_cloud_config))),
                ..Default::default()
            },
            ..Default::default()
        }),
    )
    .unwrap()
}
