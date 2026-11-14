// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use super::no_content;
use async_trait::async_trait;
use azure_core::{
    http::{
        headers::HeaderName,
        policies::{Policy, PolicyResult},
        AsyncRawResponse, ClientOptions, Context, Request,
    },
    Result,
};
use fake_tests::{clients::fake::*, models::*, *};
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc, Mutex,
};

#[derive(Default)]
struct Server(AtomicUsize);

#[async_trait]
impl FakesApiKeyServer for Server {
    async fn get(&self, _: Option<FakesApiKeyClientGetOptions<'_>>) -> Result<AsyncRawResponse> {
        self.0.fetch_add(1, Ordering::Relaxed);
        no_content()
    }
}

#[async_trait]
impl FakesApiKeyChildServer for Server {
    async fn get(
        &self,
        _: Option<FakesApiKeyChildClientGetOptions<'_>>,
    ) -> Result<AsyncRawResponse> {
        self.0.fetch_add(1, Ordering::Relaxed);
        no_content()
    }
}

#[derive(Debug)]
struct Observe(Arc<Mutex<Vec<(String, String)>>>);

#[async_trait]
impl Policy for Observe {
    async fn send(
        &self,
        context: &Context,
        request: &mut Request,
        next: &[Arc<dyn Policy>],
    ) -> PolicyResult {
        assert!(request
            .headers()
            .get_optional_str(&HeaderName::from_static("x-api-key"))
            .is_none());
        self.0.lock().unwrap().push((
            request.url().to_string(),
            request
                .headers()
                .get_str(&HeaderName::from_static("resource"))?
                .into(),
        ));
        next[0].send(context, request, &next[1..]).await
    }
}

#[tokio::test]
async fn unsupported_authentication_preserves_inputs_and_child_construction() -> Result<()> {
    let server = Arc::new(Server::default());
    let seen = Arc::new(Mutex::new(Vec::new()));
    let client_options = ClientOptions {
        per_call_policies: vec![Arc::new(Observe(seen.clone()))],
        ..Default::default()
    };
    let client = FakesApiKeyClient::with_fake(
        "https://example.test/base/",
        server.clone(),
        "tenant".into(),
        "service".into(),
        "root".into(),
        Some(FakesApiKeyClientOptions {
            version: "v2".into(),
            client_options: client_options.clone(),
        }),
    )?;
    client.get(None).await?;
    client.get_fakes_api_key_child_client().get(None).await?;
    let child = FakesApiKeyChildClient::with_fake(
        "https://example.test/base/",
        server.clone(),
        "tenant".into(),
        "service".into(),
        "child".into(),
        Some(FakesApiKeyChildClientOptions {
            client_options,
            ..Default::default()
        }),
    )?;
    child.get(None).await?;
    assert_eq!(server.0.load(Ordering::Relaxed), 3);
    assert_eq!(
        *seen.lock().unwrap(),
        [
            (
                "https://example.test/base/prefix/tenant/service/v2/items".into(),
                "root".into()
            ),
            (
                "https://example.test/base/prefix/tenant/service/v2/child".into(),
                "root".into()
            ),
            (
                "https://example.test/base/prefix/tenant/service/v1/child".into(),
                "child".into()
            ),
        ],
    );
    Ok(())
}
