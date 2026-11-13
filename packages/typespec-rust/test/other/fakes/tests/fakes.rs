// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

#![cfg(all(feature = "test", feature = "unstable_fake"))]

#[path = "fakes/construction.rs"]
mod construction;
#[path = "fakes/endpoints.rs"]
mod endpoints;

use async_trait::async_trait;
use azure_core::{
    error::ErrorKind,
    http::{
        fake::ResponseExt as _,
        headers::Headers,
        pager::{PagerOptions, PagerState},
        policies::{Policy, PolicyResult},
        poller::{PollerOptions, PollerState},
        AsyncRawResponse, Body, ClientMethodOptions, ClientOptions, Context, Method, NoFormat,
        Request, RequestContent, RetryOptions, StatusCode, Transport,
    },
    time::Duration,
    Bytes, Error, Result,
};
use fake_tests::{clients::fake::*, models::*, FakesClient, FakesClientOptions};
use futures::{io::AsyncReadExt as _, TryStreamExt as _};
use std::sync::{Arc, Mutex};

fn response(body: impl Into<Bytes>) -> Result<AsyncRawResponse> {
    Ok(AsyncRawResponse::fake_with_bytes(
        StatusCode::Ok,
        Headers::new(),
        body,
    ))
}

fn no_content() -> Result<AsyncRawResponse> {
    Ok(AsyncRawResponse::fake_with_bytes(
        StatusCode::NoContent,
        Headers::new(),
        "",
    ))
}

async fn bytes(body: Body) -> Vec<u8> {
    match body {
        Body::Bytes(bytes) => bytes.to_vec(),
        Body::SeekableStream(mut stream) => {
            let mut bytes = Vec::new();
            stream.read_to_end(&mut bytes).await.unwrap();
            bytes
        }
    }
}

#[derive(Default)]
struct Server {
    seen: Mutex<Vec<(String, Option<i32>, bool)>>,
    bodies: Mutex<Vec<Vec<u8>>>,
    lro_steps: Mutex<usize>,
    optional_bodies: Mutex<Vec<Option<Vec<u8>>>>,
}

#[async_trait]
impl FakesChildServer for Server {
    async fn get(&self, _: Option<FakesChildClientGetOptions<'_>>) -> Result<AsyncRawResponse> {
        response(r#"{"value":"child"}"#)
    }
}

#[async_trait]
impl FakesServer for Server {
    async fn fixed_group(
        &self,
        _: Option<FakesClientFixedGroupOptions<'_>>,
    ) -> Result<AsyncRawResponse> {
        response(r#"{"value":"fixed"}"#)
    }

    async fn grouped(
        &self,
        inputs: GroupedInputs<'_>,
        options: Option<FakesClientGroupedOptions<'_>>,
    ) -> Result<AsyncRawResponse> {
        assert_eq!(inputs.name, "group/name");
        assert_eq!(inputs.label, "label");
        assert_eq!(options.unwrap().count, Some(7));
        response(r#"{"value":"grouped"}"#)
    }

    async fn put_optional(
        &self,
        options: Option<FakesClientPutOptionalOptions<'_>>,
    ) -> Result<AsyncRawResponse> {
        let body = match options.unwrap().payload {
            Some(body) => Some(bytes(body.into()).await),
            None => None,
        };
        self.optional_bodies.lock().unwrap().push(body);
        response(r#"{"value":"optional"}"#)
    }

    async fn list_optional(
        &self,
        state: PagerState,
        options: Option<FakesClientListOptionalOptions<'_>>,
    ) -> Result<AsyncRawResponse> {
        assert!(matches!(state, PagerState::Initial));
        let body = match options.unwrap().payload {
            Some(body) => Some(bytes(body.into()).await),
            None => None,
        };
        self.optional_bodies.lock().unwrap().push(body);
        response(r#"{"value":[]}"#)
    }

    async fn get(
        &self,
        name: &str,
        options: Option<FakesClientGetOptions<'_>>,
    ) -> Result<AsyncRawResponse> {
        if name == "error" {
            return AsyncRawResponse::fake_with_error(
                StatusCode::NotFound,
                Headers::new(),
                "Missing",
                "not here",
            );
        }
        if name == "connection" {
            return Err(Error::with_message(ErrorKind::Io, "connection failed"));
        }
        let options = options.unwrap();
        assert_eq!(name, "a/b%invalid");
        assert_eq!(options.version.as_deref(), Some(""));
        assert_eq!(
            options.tags,
            Some(vec!["two".into(), "one".into(), "two".into()])
        );
        assert_eq!(options.header_name.as_deref(), Some("header-value"));
        assert_eq!(options.mode, Some(Mode::Second));
        assert_eq!(options.method_options.context.value::<u32>(), Some(&42));
        response(r#"{"value":"exact"}"#)
    }

    async fn list(
        &self,
        name: &str,
        state: PagerState,
        options: Option<FakesClientListOptions<'_>>,
    ) -> Result<AsyncRawResponse> {
        let options = options.unwrap();
        assert_eq!(options.method_options.context.value::<u32>(), Some(&42));
        self.seen.lock().unwrap().push((
            name.into(),
            options.count,
            matches!(state, PagerState::Initial),
        ));
        match state {
            PagerState::Initial => {
                assert!(options.method_options.continuation.is_none());
                response(r#"{"value":[{"value":"first"}],"nextLink":"https://other.test/opaque"}"#)
            }
            PagerState::More(continuation) => {
                assert_eq!(continuation, options.method_options.continuation.unwrap());
                assert_eq!(continuation.as_ref(), "https://other.test/opaque");
                response(r#"{"value":[{"value":"last"}]}"#)
            }
        }
    }

    async fn put(
        &self,
        content: RequestContent<Bytes, NoFormat>,
        _: Option<FakesClientPutOptions<'_>>,
    ) -> Result<AsyncRawResponse> {
        let body = bytes(content.into()).await;
        self.bodies.lock().unwrap().push(body);
        response(r#"{"value":"body"}"#)
    }

    async fn put_model(
        &self,
        content: RequestContent<Item>,
        _: Option<FakesClientPutModelOptions<'_>>,
    ) -> Result<AsyncRawResponse> {
        let body = bytes(content.into()).await;
        self.bodies.lock().unwrap().push(body);
        response(r#"{"value":"body"}"#)
    }

    async fn spread(
        &self,
        content: Body,
        _: Option<FakesClientSpreadOptions<'_>>,
    ) -> Result<AsyncRawResponse> {
        let body = bytes(content).await;
        self.bodies.lock().unwrap().push(body);
        response(r#"{"value":"spread"}"#)
    }

    async fn begin_start(
        &self,
        api_version: &str,
        content: Body,
        state: PollerState,
        request: &Request,
        options: Option<FakesClientBeginStartOptions<'_>>,
    ) -> Result<AsyncRawResponse> {
        assert_eq!(api_version, "original");
        assert_eq!(
            options.unwrap().method_options.frequency,
            Duration::seconds(1)
        );
        let step = {
            let mut step = self.lro_steps.lock().unwrap();
            let current = *step;
            *step += 1;
            current
        };
        let mut headers = Headers::new();
        headers.insert("retry-after-ms", "0");
        if step == 0 {
            assert!(matches!(state, PollerState::Initial));
            assert_eq!(request.method(), Method::Post);
            assert_eq!(bytes(content).await, br#"{"name":"body-name"}"#);
            headers.insert("operation-location", "https://other.test/opaque-status");
            Ok(AsyncRawResponse::fake_with_bytes(
                StatusCode::Accepted,
                headers,
                r#"{"id":"1","status":"InProgress"}"#,
            ))
        } else {
            assert!(matches!(state, PollerState::More(_)));
            assert_eq!(request.method(), Method::Get);
            assert_eq!(request.url().path(), "/opaque-status");
            assert!(bytes(content).await.is_empty());
            Ok(AsyncRawResponse::fake_with_bytes(
                StatusCode::Ok,
                headers,
                r#"{"id":"1","status":"Succeeded","result":{"value":"done"}}"#,
            ))
        }
    }
}

fn client(server: Arc<Server>) -> Result<FakesClient> {
    FakesClient::with_fake(
        "https://example.test",
        server,
        Some(FakesClientOptions {
            client_options: ClientOptions {
                retry: RetryOptions::none(),
                ..Default::default()
            },
        }),
    )
}

fn list_options(count: i32) -> Option<FakesClientListOptions<'static>> {
    Some(FakesClientListOptions {
        count: Some(count),
        method_options: PagerOptions {
            context: Context::new().with_value(42u32),
            ..Default::default()
        },
    })
}

#[tokio::test]
async fn original_arguments_and_child_routing() -> Result<()> {
    let server = Arc::new(Server::default());
    let client = client(server)?;
    let model = client
        .get(
            "a/b%invalid",
            Some(FakesClientGetOptions {
                version: Some(String::new()),
                tags: Some(vec!["two".into(), "one".into(), "two".into()]),
                header_name: Some("header-value".into()),
                mode: Some(Mode::Second),
                method_options: ClientMethodOptions {
                    context: Context::new().with_value(42u32),
                },
            }),
        )
        .await?
        .into_model()?;
    assert_eq!(model.value.as_deref(), Some("exact"));
    assert_eq!(
        client
            .get_fakes_child_client()
            .get(None)
            .await?
            .into_model()?
            .value
            .as_deref(),
        Some("child")
    );
    Ok(())
}

#[tokio::test]
async fn grouped_parameters_keep_the_normal_public_shape() -> Result<()> {
    #[derive(Debug)]
    struct CheckFixedValues;

    #[async_trait]
    impl Policy for CheckFixedValues {
        async fn send(
            &self,
            context: &Context,
            request: &mut Request,
            next: &[Arc<dyn Policy>],
        ) -> PolicyResult {
            assert!(request
                .url()
                .query_pairs()
                .any(|(key, value)| key == "fixed" && value == "fixed"));
            assert_eq!(
                request.headers().get_optional_str(&"x-fixed".into()),
                Some("first"),
            );
            next[0].send(context, request, &next[1..]).await
        }
    }

    let client = FakesClient::with_fake(
        "https://example.test",
        Arc::new(Server::default()),
        Some(FakesClientOptions {
            client_options: ClientOptions {
                per_call_policies: vec![Arc::new(CheckFixedValues)],
                ..Default::default()
            },
        }),
    )?;
    let result = client
        .grouped(
            GroupedInputs {
                name: "group/name",
                label: "label".into(),
            },
            Some(FakesClientGroupedOptions {
                count: Some(7),
                ..Default::default()
            }),
        )
        .await?;
    assert_eq!(result.into_model()?.value.as_deref(), Some("grouped"));
    assert_eq!(
        client
            .fixed_group(None)
            .await?
            .into_model()?
            .value
            .as_deref(),
        Some("fixed"),
    );
    Ok(())
}

#[tokio::test]
async fn optional_bodies_preserve_presence_empty_content_and_policy_changes() -> Result<()> {
    let server = Arc::new(Server::default());
    let normal = client(server.clone())?;
    normal.put_optional(None).await?;
    for data in [vec![], vec![0, 255, 1]] {
        normal
            .put_optional(Some(FakesClientPutOptionalOptions {
                payload: Some(RequestContent::from(data)),
                ..Default::default()
            }))
            .await?;
    }
    let modified = FakesClient::with_fake(
        "https://example.test",
        server.clone(),
        Some(FakesClientOptions {
            client_options: ClientOptions {
                per_call_policies: vec![Arc::new(ReplaceBody)],
                ..Default::default()
            },
        }),
    )?;
    modified
        .put_optional(Some(FakesClientPutOptionalOptions {
            payload: Some(RequestContent::from(b"original".to_vec())),
            ..Default::default()
        }))
        .await?;
    let mut pages = normal
        .list_optional(Some(FakesClientListOptionalOptions {
            payload: Some(RequestContent::from(vec![])),
            ..Default::default()
        }))?
        .into_pages();
    assert!(pages.try_next().await?.is_some());
    assert_eq!(
        *server.optional_bodies.lock().unwrap(),
        vec![
            None,
            Some(vec![]),
            Some(vec![0, 255, 1]),
            Some(b"changed by policy".to_vec()),
            Some(vec![])
        ]
    );
    Ok(())
}

#[tokio::test]
async fn opaque_continuations_resume_and_interleave_without_shared_state() -> Result<()> {
    let server = Arc::new(Server::default());
    let client = client(server.clone())?;
    let mut first = client.list("first/name", list_options(2))?.into_pages();
    let mut second = client.list("second%name", list_options(3))?.into_pages();
    assert!(first.try_next().await?.is_some());
    assert!(second.try_next().await?.is_some());
    let continuation = first.continuation().unwrap().clone();
    assert!(first.try_next().await?.is_some());
    assert!(second.try_next().await?.is_some());
    let fresh = FakesClient::with_fake("https://different.test", server.clone(), None)?;
    let mut options = list_options(4).unwrap();
    options.method_options.continuation = Some(continuation);
    let mut resumed = fresh.list("resumed/name", Some(options))?.into_pages();
    assert!(resumed.try_next().await?.is_some());
    assert!(resumed.try_next().await?.is_none());
    assert_eq!(
        *server.seen.lock().unwrap(),
        vec![
            ("first/name".into(), Some(2), true),
            ("second%name".into(), Some(3), true),
            ("first/name".into(), Some(2), false),
            ("second%name".into(), Some(3), false),
            ("resumed/name".into(), Some(4), false),
        ]
    );
    Ok(())
}

#[tokio::test]
async fn opaque_body_bytes_streams_and_spread() -> Result<()> {
    let server = Arc::new(Server::default());
    let client = client(server.clone())?;
    client
        .put(RequestContent::from(vec![0, 255, 1]), None)
        .await?;
    client
        .put(
            RequestContent::from_reader(futures::io::Cursor::new(vec![2, 254, 3]), Some(3)),
            None,
        )
        .await?;
    client
        .put_model(RequestContent::from(b"not JSON".to_vec()), None)
        .await?;
    client
        .spread(
            "original".into(),
            Some(FakesClientSpreadOptions {
                optional: Some("also".into()),
                ..Default::default()
            }),
        )
        .await?;
    let bodies = server.bodies.lock().unwrap();
    assert_eq!(
        &bodies[..3],
        &[vec![0, 255, 1], vec![2, 254, 3], b"not JSON".to_vec()]
    );
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&bodies[3])?,
        serde_json::json!({"value": "original", "optional": "also"})
    );
    Ok(())
}

#[derive(Debug)]
struct ReplaceBody;
#[async_trait]
impl Policy for ReplaceBody {
    async fn send(
        &self,
        context: &Context,
        request: &mut Request,
        next: &[Arc<dyn Policy>],
    ) -> PolicyResult {
        request.set_body(b"changed by policy".to_vec());
        next[0].send(context, request, &next[1..]).await
    }
}

#[tokio::test]
async fn forwards_post_policy_body() -> Result<()> {
    let server = Arc::new(Server::default());
    let client = FakesClient::with_fake(
        "https://example.test",
        server.clone(),
        Some(FakesClientOptions {
            client_options: ClientOptions {
                per_call_policies: vec![Arc::new(ReplaceBody)],
                ..Default::default()
            },
        }),
    )?;
    client
        .put_model(RequestContent::from(b"original".to_vec()), None)
        .await?;
    assert_eq!(
        *server.bodies.lock().unwrap(),
        vec![b"changed by policy".to_vec()]
    );
    Ok(())
}

#[tokio::test]
async fn data_plane_lro_preserves_state_and_actual_request_body() -> Result<()> {
    let server = Arc::new(Server::default());
    let client = client(server.clone())?;
    let response = client
        .begin_start(
            "original",
            "body-name".into(),
            Some(FakesClientBeginStartOptions {
                method_options: PollerOptions {
                    frequency: Duration::seconds(1),
                    ..Default::default()
                },
            }),
        )?
        .await?;
    assert_eq!(response.into_model()?.value.as_deref(), Some("done"));
    assert_eq!(*server.lro_steps.lock().unwrap(), 2);
    Ok(())
}

#[tokio::test]
async fn errors_transport_conflict_and_unrestricted_endpoint() -> Result<()> {
    let server = Arc::new(Server::default());
    let dyn_server: Arc<dyn FakesServer> = server.clone();
    FakesClient::with_fake("custom://example.test", dyn_server, None)?;
    assert!(FakesClient::with_fake("not a URL", server.clone(), None).is_err());
    assert!(FakesClient::with_fake(
        "https://example.test",
        server.clone(),
        Some(FakesClientOptions {
            client_options: ClientOptions {
                transport: Some(Transport::default()),
                ..Default::default()
            },
        })
    )
    .is_err());
    let client = client(server)?;
    let error = client.get("error", None).await.unwrap_err();
    assert!(format!("{error:?}").contains("Missing"));
    let error = client.get("connection", None).await.unwrap_err();
    assert!(format!("{error:?}").contains("connection failed"));
    Ok(())
}
