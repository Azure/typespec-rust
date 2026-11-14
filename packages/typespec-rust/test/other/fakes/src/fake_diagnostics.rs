// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use crate::{clients::fake::*, FakesClient};
use azure_core::{
    http::{Context, Method, Request, Url},
    tracing::PublicApiInstrumentationInformation,
    Result,
};
use std::sync::Arc;

struct Server;
impl FakesChildServer for Server {}
impl FakesServer for Server {}

#[tokio::test]
async fn dispatch_reports_missing_and_unknown_metadata() -> Result<()> {
    let client = FakesClient::with_fake("https://example.test", Arc::new(Server), None)?;
    for (api_name, expected) in [
        (None, "missing API name"),
        (Some("unknown"), "unknown API name 'unknown'"),
        (Some("Fakes.get"), "Fakes.get: missing operation arguments"),
    ] {
        let mut context = Context::new();
        if let Some(api_name) = api_name {
            context.insert(PublicApiInstrumentationInformation::new(
                api_name,
                Vec::new(),
            ));
        }
        let mut request = Request::new(Url::parse("https://example.test")?, Method::Get);
        let error = client
            .pipeline
            .send(&context, &mut request, None)
            .await
            .unwrap_err();
        assert!(format!("{error:?}").contains(expected), "{error:?}");
    }
    let mut context = Context::new();
    crate::clients::fake::capture_fakes_client_list(&mut context, "original".into(), Some(2));
    let mut request = Request::new(Url::parse("https://example.test")?, Method::Get);
    let error = crate::generated::clients::fake::fakes_client::dispatch_list(
        &Server,
        &context,
        &mut request,
        "Fakes.list",
    )
    .await
    .unwrap_err();
    assert!(error
        .to_string()
        .contains("Fakes.list: missing operation state"));
    Ok(())
}
