// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use async_trait::async_trait;
use azure_core::{
    http::{
        fake::ResponseExt as _,
        headers::Headers,
        poller::{resource_manager::PollerOptions, PollerState},
        AsyncRawResponse, Request, StatusCode,
    },
    time::Duration,
    Result,
};
use azure_resourcemanager_test::{
    clients::fake::*, models::ResourceManagerClientBeginEmptyResultOptions, ResourceManagerClient,
};
use std::sync::Arc;

struct Server;

impl ResourceManagerHsmConnectionsServer for Server {}
impl ResourceManagerManagedHsmsServer for Server {}
impl ResourceManagerVaultConnectionsServer for Server {}
impl ResourceManagerVaultsServer for Server {}

#[async_trait]
impl ResourceManagerServer for Server {
    async fn begin_empty_result(
        &self,
        state: PollerState,
        _request: &Request,
        _options: Option<ResourceManagerClientBeginEmptyResultOptions<'_>>,
    ) -> Result<AsyncRawResponse> {
        let mut headers = Headers::new();
        headers.insert("retry-after-ms", "0");
        let (status, body) = match state {
            PollerState::Initial => {
                headers.insert("azure-asyncoperation", "https://example.test/operations/1");
                (StatusCode::Accepted, "")
            }
            PollerState::More(_) => (StatusCode::Ok, r#"{"status":"Succeeded"}"#),
        };
        Ok(AsyncRawResponse::fake_with_bytes(status, headers, body))
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<()> {
    let client = ResourceManagerClient::with_fake(
        "https://example.test",
        Arc::new(Server),
        "subscription".into(),
        None,
    )?;
    let response = client
        .begin_empty_result(Some(ResourceManagerClientBeginEmptyResultOptions {
            method_options: PollerOptions {
                frequency: Duration::seconds(1),
                ..Default::default()
            },
        }))?
        .await?;
    assert_eq!(response.status(), StatusCode::Ok);
    println!("Completed a fake ARM long-running operation.");
    Ok(())
}
