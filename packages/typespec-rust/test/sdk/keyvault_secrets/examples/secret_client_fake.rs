// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use async_trait::async_trait;
use azure_core::{
    http::{
        fake::ResponseExt as _, headers::Headers, pager::PagerState, AsyncRawResponse, StatusCode,
    },
    Result,
};
use futures::TryStreamExt as _;
use keyvault_secrets::{
    clients::fake::SecretServer,
    models::{SecretClientGetSecretOptions, SecretClientListSecretPropertiesOptions},
    SecretClient,
};
use std::sync::Arc;

struct Server;

#[async_trait]
impl SecretServer for Server {
    async fn list_secret_properties(
        &self,
        state: PagerState,
        _options: Option<SecretClientListSecretPropertiesOptions<'_>>,
    ) -> Result<AsyncRawResponse> {
        assert!(matches!(state, PagerState::Initial));
        Ok(AsyncRawResponse::fake_with_bytes(
            StatusCode::Ok,
            Headers::new(),
            r#"{"value":[{"id":"https://example.test/secrets/first"},{"id":"https://example.test/secrets/second"}]}"#,
        ))
    }

    async fn get_secret(
        &self,
        name: &str,
        _options: Option<SecretClientGetSecretOptions<'_>>,
    ) -> Result<AsyncRawResponse> {
        let body = match name {
            "first" => r#"{"value":"first-value"}"#,
            "second" => r#"{"value":"second-value"}"#,
            _ => {
                return AsyncRawResponse::fake_with_error(
                    StatusCode::NotFound,
                    Headers::new(),
                    "SecretNotFound",
                    "The secret does not exist.",
                )
            }
        };
        Ok(AsyncRawResponse::fake_with_bytes(
            StatusCode::Ok,
            Headers::new(),
            body,
        ))
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<()> {
    let client = SecretClient::with_fake("https://example.test", Arc::new(Server), None)?;
    let secrets: Vec<_> = client.list_secret_properties(None)?.try_collect().await?;
    assert_eq!(secrets.len(), 2);
    for (name, expected) in [("first", "first-value"), ("second", "second-value")] {
        let secret = client.get_secret(name, None).await?.into_model()?;
        assert_eq!(secret.value.as_deref(), Some(expected));
    }
    let error = client.get_secret("missing", None).await.unwrap_err();
    assert!(format!("{error:?}").contains("SecretNotFound"));
    println!("Returned two secrets and simulated a service error.");
    Ok(())
}
