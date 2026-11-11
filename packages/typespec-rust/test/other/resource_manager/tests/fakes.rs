// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

#![cfg(all(feature = "test", feature = "unstable_fake"))]

use async_trait::async_trait;
use azure_core::{
    http::{
        fake::ResponseExt as _,
        headers::Headers,
        poller::{resource_manager::PollerOptions, PollerState},
        AsyncRawResponse, Body, Context, Method, Request, RequestContent, StatusCode,
    },
    time::Duration,
    Result,
};
use azure_resourcemanager_test::{clients::fake::*, models::*, ResourceManagerClient};
use std::sync::{Arc, Mutex};

#[derive(Default)]
struct Server {
    requests: Mutex<Vec<(Method, bool, bool)>>,
}

impl ResourceManagerHsmConnectionsServer for Server {}
impl ResourceManagerManagedHsmsServer for Server {}
impl ResourceManagerVaultConnectionsServer for Server {}

#[async_trait]
impl ResourceManagerVaultsServer for Server {
    async fn begin_create_or_update(
        &self,
        group: &str,
        name: &str,
        api_version: String,
        subscription: String,
        _content: RequestContent<Vault>,
        _state: PollerState,
        _request: &Request,
        _options: Option<ResourceManagerVaultsClientBeginCreateOrUpdateOptions<'_>>,
    ) -> Result<AsyncRawResponse> {
        assert_eq!((group, name), ("group", "child"));
        assert_eq!(subscription, "sub");
        assert_eq!(api_version, "2026-05-15");
        Ok(AsyncRawResponse::fake_with_bytes(
            StatusCode::Ok,
            Headers::new(),
            r#"{"name":"child","location":"westus","properties":{"provisioningState":"Succeeded"}}"#,
        ))
    }
}

#[async_trait]
impl ResourceManagerServer for Server {
    async fn begin_async_result(
        &self,
        group: &str,
        name: &str,
        api_version: String,
        subscription: String,
        content: RequestContent<Vault>,
        state: PollerState,
        request: &Request,
        options: Option<ResourceManagerClientBeginAsyncResultOptions<'_>>,
    ) -> Result<AsyncRawResponse> {
        assert_eq!((group, name), ("group/slash", "vault%invalid"));
        assert_eq!(api_version, "2026-05-15");
        assert_eq!(subscription, "sub");
        let options = options.unwrap();
        assert_eq!(options.method_options.frequency, Duration::seconds(1));
        assert_eq!(options.method_options.context.value::<u32>(), Some(&42));
        let Body::Bytes(body) = Body::from(content) else {
            panic!("expected bytes");
        };
        let step = {
            let mut requests = self.requests.lock().unwrap();
            let step = requests.len();
            requests.push((
                request.method(),
                matches!(state, PollerState::Initial),
                body.is_empty(),
            ));
            step
        };
        let mut headers = Headers::new();
        headers.insert("retry-after-ms", "0");
        let (status, body) = match step {
            0 => {
                assert!(String::from_utf8_lossy(&body).contains("original"));
                headers.insert("azure-asyncoperation", "https://opaque.test/status");
                (StatusCode::Accepted, "")
            }
            1 => {
                assert_eq!(request.url().host_str(), Some("opaque.test"));
                assert_eq!(request.url().path(), "/status");
                (StatusCode::Ok, r#"{"status":"Succeeded"}"#)
            }
            2 => {
                assert!(request.url().path().contains("/vaults/"));
                (
                    StatusCode::Ok,
                    r#"{"name":"final","location":"westus","properties":{"provisioningState":"Succeeded"}}"#,
                )
            }
            _ => panic!("unexpected HTTP step"),
        };
        Ok(AsyncRawResponse::fake_with_bytes(status, headers, body))
    }
}

#[tokio::test]
async fn arm_fake_retains_original_arguments_through_polling_and_final_get() -> Result<()> {
    let server = Arc::new(Server::default());
    let client = ResourceManagerClient::with_fake(
        "https://example.test",
        server.clone(),
        "sub".into(),
        None,
    )?;
    let result = client
        .begin_async_result(
            "group/slash",
            "vault%invalid",
            RequestContent::from(
                br#"{"location":"westus","properties":{"value":"original"}}"#.to_vec(),
            ),
            Some(ResourceManagerClientBeginAsyncResultOptions {
                method_options: PollerOptions {
                    context: Context::new().with_value(42u32),
                    frequency: Duration::seconds(1),
                },
            }),
        )?
        .await?;
    assert_eq!(result.into_model()?.name.as_deref(), Some("final"));
    assert_eq!(
        *server.requests.lock().unwrap(),
        vec![
            (Method::Put, true, false),
            (Method::Get, false, true),
            (Method::Get, false, true),
        ]
    );
    Ok(())
}

#[tokio::test]
async fn arm_child_lro_can_complete_immediately() -> Result<()> {
    let client = ResourceManagerClient::with_fake(
        "https://example.test",
        Arc::new(Server::default()),
        "sub".into(),
        None,
    )?;
    let result = client
        .get_resource_manager_vaults_client()
        .begin_create_or_update(
            "group",
            "child",
            RequestContent::from(br#"{"location":"westus"}"#.to_vec()),
            None,
        )?
        .await?;
    assert_eq!(result.into_model()?.name.as_deref(), Some("child"));
    Ok(())
}
