// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

#![cfg(all(feature = "test", feature = "unstable_fake"))]

use async_trait::async_trait;
use azure_core::{
    http::{
        fake::ResponseExt as _,
        headers::Headers,
        policies::{Policy, PolicyResult},
        AsyncRawResponse, ClientOptions, Context, Request, StatusCode,
    },
    Result,
};
use fake_endpoint_tests::{clients::fake::*, models::*, *};
use std::sync::{Arc, Mutex};

struct Server;

#[async_trait]
impl EndpointServer for Server {
    async fn get(&self, _: Option<EndpointClientGetOptions<'_>>) -> Result<AsyncRawResponse> {
        Ok(AsyncRawResponse::fake_with_bytes(
            StatusCode::NoContent,
            Headers::new(),
            "",
        ))
    }
}

#[async_trait]
impl EndpointEndpointChildServer for Server {
    async fn get(
        &self,
        _: Option<EndpointEndpointChildClientGetOptions<'_>>,
    ) -> Result<AsyncRawResponse> {
        Ok(AsyncRawResponse::fake_with_bytes(
            StatusCode::NoContent,
            Headers::new(),
            "",
        ))
    }
}

#[derive(Debug)]
struct Observe(Arc<Mutex<Vec<String>>>);

#[async_trait]
impl Policy for Observe {
    async fn send(
        &self,
        context: &Context,
        request: &mut Request,
        next: &[Arc<dyn Policy>],
    ) -> PolicyResult {
        self.0.lock().unwrap().push(request.url().to_string());
        next[0].send(context, request, &next[1..]).await
    }
}

#[tokio::test]
async fn supplemental_paths_match_normal_root_and_independent_child_construction() -> Result<()> {
    for version in [None, Some("v2")] {
        let seen = Arc::new(Mutex::new(Vec::new()));
        let options = EndpointClientOptions {
            version: version.unwrap_or("v1").into(),
            client_options: ClientOptions {
                per_call_policies: vec![Arc::new(Observe(seen.clone()))],
                ..Default::default()
            },
        };
        let normal = EndpointClient::with_no_credential(
            "https://example.test/base/",
            "tenant".into(),
            Some(options.clone()),
        )?;
        let fake = EndpointClient::with_fake(
            "https://example.test/base/",
            Arc::new(Server),
            "tenant".into(),
            Some(options.clone()),
        )?;
        assert_eq!(normal.endpoint(), fake.endpoint());
        assert_eq!(
            fake.endpoint().path(),
            format!("/base/prefix/tenant/{}", version.unwrap_or("v1"))
        );
        fake.get(None).await?;
        fake.get_endpoint_endpoint_child_client().get(None).await?;

        let child_options = EndpointEndpointChildClientOptions {
            version: options.version,
            client_options: options.client_options,
        };
        let normal_child = EndpointEndpointChildClient::with_no_credential(
            "https://example.test/base/",
            "tenant".into(),
            Some(child_options.clone()),
        )?;
        let fake_child = EndpointEndpointChildClient::with_fake(
            "https://example.test/base/",
            Arc::new(Server),
            "tenant".into(),
            Some(child_options),
        )?;
        assert_eq!(normal_child.endpoint(), fake_child.endpoint());
        fake_child.get(None).await?;
        let base = fake.endpoint().as_str();
        assert_eq!(
            *seen.lock().unwrap(),
            vec![
                format!("{base}/items"),
                format!("{base}/child"),
                format!("{base}/child")
            ]
        );
    }
    Ok(())
}
