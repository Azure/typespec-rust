// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use azure_core::{
    http::{
        headers::{HeaderName, Headers},
        request::Body,
        AsyncRawResponse, HttpClient, Request, StatusCode, Transport,
    },
    Result,
};
use misc_tests::{models::*, MiscTestsClient, MiscTestsClientOptions};
use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
};

#[derive(Debug)]
struct Captured {
    path: String,
    query: BTreeMap<String, String>,
    fixed_header: Option<String>,
    optional_header: Option<String>,
    body: Option<Value>,
}

#[derive(Debug, Default)]
struct Capture(Mutex<Vec<Captured>>);

#[async_trait::async_trait]
impl HttpClient for Capture {
    async fn execute_request(&self, request: &Request) -> Result<AsyncRawResponse> {
        let Body::Bytes(bytes) = request.body() else {
            panic!("expected serialized bytes");
        };
        self.0.lock().unwrap().push(Captured {
            path: request.url().path().into(),
            query: request.url().query_pairs().into_owned().collect(),
            fixed_header: request
                .headers()
                .get_optional_str(&HeaderName::from_static("x-fixed"))
                .map(str::to_owned),
            optional_header: request
                .headers()
                .get_optional_str(&HeaderName::from_static("x-optional-fixed"))
                .map(str::to_owned),
            body: if bytes.is_empty() {
                None
            } else {
                Some(serde_json::from_slice(bytes)?)
            },
        });
        Ok(AsyncRawResponse::from_bytes(
            StatusCode::NoContent,
            Headers::new(),
            b"".as_slice(),
        ))
    }
}

fn client() -> Result<(MiscTestsClient, Arc<Capture>)> {
    let capture = Arc::new(Capture::default());
    let mut options = MiscTestsClientOptions::default();
    options.client_options.transport = Some(Transport::new(capture.clone()));
    Ok((
        MiscTestsClient::with_no_credential("https://example.test", Some(options))?,
        capture,
    ))
}

#[tokio::test]
async fn mixed_group_preserves_optional_enum_presence_and_sends_declared_constants() -> Result<()> {
    let (client, capture) = client()?;
    for present in [false, true] {
        client
            .fixed_inputs(
                FixedInputs {
                    name: "name",
                    color: Colors::Yellow,
                },
                Some(MiscTestsClientFixedInputsOptions {
                    optional_fixed: present.then(|| "ignored".into()),
                    optional_color: present.then_some(Colors::Yellow),
                    optional_header: present.then_some(Colors::Yellow),
                    ..Default::default()
                }),
            )
            .await?;
    }
    let requests = capture.0.lock().unwrap();
    assert_eq!(requests.len(), 2);
    for (request, present) in requests.iter().zip([false, true]) {
        assert_eq!(request.path, "/supplemental-path/fixed/constant/name");
        assert_eq!(request.query["fixed"], "fixed");
        assert_eq!(request.query["color"], "yellow");
        assert_eq!(request.fixed_header.as_deref(), Some("blue"));
        assert_eq!(
            request.query.get("optionalFixed").map(String::as_str),
            Some("optional"),
        );
        assert_eq!(
            request.query.get("optionalColor").map(String::as_str),
            present.then_some("blue"),
        );
        assert_eq!(
            request.optional_header.as_deref(),
            present.then_some("green"),
        );
    }
    Ok(())
}

#[tokio::test]
async fn fixed_only_and_ungrouped_operations_need_no_fixed_inputs() -> Result<()> {
    let (client, capture) = client()?;
    client.only_fixed_inputs(None).await?;
    client.ungrouped_fixed_inputs(None).await?;
    client.with_optional_client_query_param(None).await?;
    let requests = capture.0.lock().unwrap();
    assert_eq!(requests.len(), 3);
    for request in &requests[..2] {
        assert_eq!(request.query["fixed"], "fixed");
        assert_eq!(request.fixed_header.as_deref(), Some("blue"));
    }
    assert!(!requests[0].query.contains_key("optionalFixed"));
    assert_eq!(requests[1].query["optionalFixed"], "optional");
    assert_eq!(
        requests[1].path,
        "/supplemental-path/ungrouped-fixed/constant"
    );
    assert_eq!(requests[2].query["clientFixed"], "client");
    Ok(())
}

#[tokio::test]
async fn optional_only_group_models_remain_available_for_payloads() -> Result<()> {
    let (client, capture) = client()?;
    client.optional_body_inputs(None).await?;
    client.optional_response_inputs(None).await?;
    client
        .shared_optional_body(
            SharedOptionalBody {
                inputs: Some(OptionalBodyInputs {
                    name: Some("name".into()),
                    color: Some(Colors::Yellow),
                }),
            }
            .try_into()?,
            None,
        )
        .await?;
    let requests = capture.0.lock().unwrap();
    assert_eq!(
        requests[2].body,
        Some(json!({"inputs": {"name": "name", "color": "yellow"}})),
    );
    let response: SharedOptionalResponse =
        serde_json::from_value(json!({"inputs": {"name": "response", "color": "blue"}}))?;
    let inputs = response.inputs.unwrap();
    assert_eq!(inputs.name.as_deref(), Some("response"));
    assert_eq!(inputs.color, Some(Colors::Blue));
    Ok(())
}

#[tokio::test]
async fn body_fields_and_spread_body_constants_are_unchanged() -> Result<()> {
    let (client, capture) = client()?;
    client
        .fixed_body(
            FixedBody {
                name: Some("name".into()),
                fixed: Some("ignored".into()),
                fixed_enum: Some(Colors::Yellow),
                ..Default::default()
            }
            .try_into()?,
            None,
        )
        .await?;
    client
        .fixed_spread_body(
            "name".into(),
            "ignored".into(),
            Colors::Yellow,
            Some(MiscTestsClientFixedSpreadBodyOptions {
                optional_fixed: Some("ignored".into()),
                ..Default::default()
            }),
        )
        .await?;
    let requests = capture.0.lock().unwrap();
    assert_eq!(requests.len(), 2);
    assert_eq!(
        requests[0].body,
        Some(json!({"name": "name", "fixed": "body", "fixedEnum": "blue"})),
    );
    assert_eq!(
        requests[1].body,
        Some(json!({
            "name": "name",
            "fixed": "body",
            "fixedEnum": "blue",
            "optionalFixed": "optional",
        })),
    );
    Ok(())
}
