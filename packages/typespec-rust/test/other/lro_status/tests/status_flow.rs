use azure_core::{
    http::{
        headers::{HeaderName, Headers},
        poller::{PollerOptions, PollerStatus, StatusMonitor},
        AsyncRawResponse, ClientOptions, HttpClient, StatusCode, Transport,
    },
    Result,
};
use futures::TryStreamExt;
use lro_status::{
    clients::{LroStatusTestClient, LroStatusTestClientOptions, LroStatusTestSnapshotsClient},
    models::{
        LroStatusTestSnapshotsClientBeginMixedOptions,
        LroStatusTestSnapshotsClientBeginMonitorOptions,
        LroStatusTestSnapshotsClientBeginStatusFlowOperationStatus,
        LroStatusTestSnapshotsClientBeginStatusFlowOptions, Snapshot, SnapshotStatus,
    },
};
use std::{
    collections::VecDeque,
    sync::{Arc, Mutex},
};

#[derive(Debug)]
struct ScriptedClient {
    responses: Mutex<VecDeque<&'static str>>,
    requests: Mutex<Vec<(String, String)>>,
}

#[async_trait::async_trait]
impl HttpClient for ScriptedClient {
    async fn execute_request(
        &self,
        request: &azure_core::http::Request,
    ) -> Result<AsyncRawResponse> {
        self.respond(request, StatusCode::Ok)
    }
}

impl ScriptedClient {
    fn respond(
        &self,
        request: &azure_core::http::Request,
        status: StatusCode,
    ) -> Result<AsyncRawResponse> {
        let mut requests = self.requests.lock().unwrap();
        requests.push((
            request.method().as_str().to_owned(),
            request.url().path().to_owned(),
        ));
        let body = self
            .responses
            .lock()
            .unwrap()
            .pop_front()
            .expect("unexpected HTTP request");
        let mut headers = Headers::new();
        if requests.len() == 1 {
            headers.insert(
                HeaderName::from_static("operation-location"),
                "http://localhost/operations/create",
            );
        }
        Ok(AsyncRawResponse::from_bytes(status, headers, body))
    }
}

fn scripted(responses: &[&'static str]) -> (LroStatusTestSnapshotsClient, Arc<ScriptedClient>) {
    let script = Arc::new(ScriptedClient {
        responses: Mutex::new(responses.iter().copied().collect()),
        requests: Mutex::new(Vec::new()),
    });
    let client = LroStatusTestClient::with_no_credential(
        "http://localhost",
        Some(LroStatusTestClientOptions {
            client_options: ClientOptions {
                transport: Some(Transport::new(script.clone())),
                ..Default::default()
            },
        }),
    )
    .unwrap()
    .get_lro_status_test_snapshots_client();
    (client, script)
}

fn options() -> PollerOptions<'static> {
    PollerOptions {
        frequency: azure_core::time::Duration::seconds(1),
        ..Default::default()
    }
}

#[derive(Debug)]
struct MixedClient {
    initial_status: StatusCode,
    script: ScriptedClient,
}

#[async_trait::async_trait]
impl HttpClient for MixedClient {
    async fn execute_request(
        &self,
        request: &azure_core::http::Request,
    ) -> Result<AsyncRawResponse> {
        assert_eq!(
            request
                .headers()
                .get_optional_string(&HeaderName::from_static("x-is-initial"))
                .as_deref(),
            Some("caller-value")
        );
        let initial = self.script.requests.lock().unwrap().is_empty();
        self.script.respond(
            request,
            if initial {
                self.initial_status
            } else {
                StatusCode::Ok
            },
        )
    }
}

#[tokio::test]
async fn appconfig_resource_initialization_and_mixed_monitors_preserve_input_header() {
    for (status, initial, monitor) in [
        (
            StatusCode::Created,
            r#"{"id":"snapshot","status":"provisioning"}"#,
            true,
        ),
        (
            StatusCode::Created,
            r#"{"id":"snapshot","status":"InProgress"}"#,
            true,
        ),
        (StatusCode::Created, r#"{"status":"Succeeded"}"#, true),
        (StatusCode::Created, r#"{"status":"Failed"}"#, true),
        (StatusCode::Created, r#"{}"#, true),
        (StatusCode::Created, "", true),
        (StatusCode::Accepted, r#"{"status":"Running"}"#, true),
        (StatusCode::Accepted, r#"{"status":"Succeeded"}"#, false),
    ] {
        let mut responses = VecDeque::from([initial]);
        if monitor {
            responses.push_back(r#"{"status":"Succeeded"}"#);
        }
        responses.push_back(r#"{"id":"snapshot","status":"ready"}"#);
        let transport = Arc::new(MixedClient {
            initial_status: status,
            script: ScriptedClient {
                responses: Mutex::new(responses),
                requests: Mutex::new(Vec::new()),
            },
        });
        let client = LroStatusTestClient::with_no_credential(
            "http://localhost",
            Some(LroStatusTestClientOptions {
                client_options: ClientOptions {
                    transport: Some(Transport::new(transport.clone())),
                    ..Default::default()
                },
            }),
        )
        .unwrap()
        .get_lro_status_test_snapshots_client();
        let output: Snapshot = client
            .begin_mixed(
                "caller-value".into(),
                Some(LroStatusTestSnapshotsClientBeginMixedOptions {
                    method_options: options(),
                }),
            )
            .unwrap()
            .await
            .unwrap()
            .into_body()
            .json()
            .unwrap();
        assert_eq!(output.id.as_deref(), Some("snapshot"));
        assert!(matches!(output.status, Some(SnapshotStatus::Ready)));
        let requests = transport.script.requests.lock().unwrap();
        assert_eq!(requests.len(), if monitor { 3 } else { 2 });
        assert_eq!(requests[0], ("PUT".into(), "/snapshots/mixed".into()));
        if monitor {
            assert_eq!(requests[1], ("GET".into(), "/operations/create".into()));
        }
        assert_eq!(
            requests.last().unwrap(),
            &("GET".into(), "/snapshots/mixed".into())
        );
        assert!(transport.script.responses.lock().unwrap().is_empty());
    }
}

#[tokio::test]
async fn initial_monitor_rejects_empty_or_invalid_status() {
    for invalid in ["", r#"{"status":42}"#, "{"] {
        let (client, script) = scripted(&[invalid]);
        assert!(client.begin_monitor("1.0", None).unwrap().await.is_err());
        assert_eq!(script.requests.lock().unwrap().len(), 1);
    }
}

#[tokio::test]
async fn missing_or_null_monitor_status_uses_existing_progress_semantics() {
    for missing in ["{}", r#"{"status":null}"#] {
        let (client, script) = scripted(&[
            missing,
            missing,
            r#"{"status":"Succeeded"}"#,
            r#"{"id":"snapshot","status":"ready"}"#,
        ]);
        let output: Snapshot = client
            .begin_monitor(
                "1.0",
                Some(LroStatusTestSnapshotsClientBeginMonitorOptions {
                    method_options: options(),
                }),
            )
            .unwrap()
            .await
            .unwrap()
            .into_body()
            .json()
            .unwrap();
        assert_eq!(output.id.as_deref(), Some("snapshot"));
        assert_eq!(script.requests.lock().unwrap().len(), 4);
    }
}

#[test]
fn provisioning_is_a_lifecycle_value_but_an_unknown_operation_status() {
    let initial: Snapshot =
        azure_core::json::from_json(br#"{"id":"snapshot","status":"provisioning"}"#).unwrap();
    assert!(matches!(initial.status, Some(SnapshotStatus::Provisioning)));
    let monitor: LroStatusTestSnapshotsClientBeginStatusFlowOperationStatus =
        azure_core::json::from_json(br#"{"status":"provisioning"}"#).unwrap();
    assert_eq!(
        monitor.status(),
        PollerStatus::UnknownValue("provisioning".to_owned())
    );
}

#[tokio::test]
async fn ignores_initial_lifecycle_status_and_preserves_raw_intermediate_responses() {
    for initial in [
        r#"{"id":"snapshot","status":"provisioning"}"#,
        r#"{"status":"Succeeded"}"#,
        r#"{"status":"Failed"}"#,
        r#"{"status":"Canceled"}"#,
        r#"{"properties":{"status":"Succeeded"}}"#,
        r#"{}"#,
        "",
    ] {
        let (client, script) = scripted(&[
            initial,
            r#"{"status":"NotStarted"}"#,
            r#"{"status":"Running"}"#,
            r#"{"status":"provisioning"}"#,
            r#"{"status":"InProgress"}"#,
            r#"{"status":"future-state"}"#,
            r#"{"status":"sUcCeEdEd"}"#,
            r#"{"id":"snapshot","status":"ready"}"#,
        ]);
        let mut poller = client
            .begin_status_flow(
                "1.0",
                Some(LroStatusTestSnapshotsClientBeginStatusFlowOptions {
                    method_options: options(),
                }),
            )
            .unwrap();
        let response = poller.try_next().await.unwrap().unwrap();
        assert_eq!(response.body().as_ref(), initial.as_bytes());
        assert_eq!(response.status(), StatusCode::Ok);
        assert_eq!(
            response
                .headers()
                .get_optional_string(&HeaderName::from_static("operation-location"))
                .as_deref(),
            Some("http://localhost/operations/create")
        );
        let output: Snapshot = poller.await.unwrap().into_body().json().unwrap();
        assert_eq!(output.id.as_deref(), Some("snapshot"));
        let requests = script.requests.lock().unwrap();
        assert_eq!(requests.len(), 8, "initial {initial}");
        assert_eq!(requests[0], ("PUT".into(), "/snapshots/status-flow".into()));
        for request in &requests[1..7] {
            assert_eq!(request, &("GET".into(), "/operations/create".into()));
        }
        assert_eq!(requests[7], ("GET".into(), "/snapshots/status-flow".into()));
        assert!(script.responses.lock().unwrap().is_empty());
    }
}

#[tokio::test]
async fn honors_initial_operation_monitor_without_decoding_unneeded_required_fields() {
    for initial in [
        r#"{"status":"sUcCeEdEd"}"#,
        r#"{"status":"Succe\u0065ded"}"#,
    ] {
        let (client, script) = scripted(&[initial, r#"{"id":"snapshot","status":"ready"}"#]);
        let output: Snapshot = client
            .begin_monitor(
                "1.0",
                Some(LroStatusTestSnapshotsClientBeginMonitorOptions {
                    method_options: options(),
                }),
            )
            .unwrap()
            .await
            .unwrap()
            .into_body()
            .json()
            .unwrap();
        assert_eq!(output.id.as_deref(), Some("snapshot"));
        assert_eq!(script.requests.lock().unwrap().len(), 2);
    }
}

#[tokio::test]
async fn terminal_monitor_failure_and_both_cancellation_spellings_stop_polling() {
    for terminal in [
        r#"{"status":"fAiLeD"}"#,
        r#"{"status":"cAnCeLeD"}"#,
        r#"{"status":"cAnCeLlEd"}"#,
    ] {
        let (client, script) = scripted(&[r#"{"status":"provisioning"}"#, terminal]);
        assert!(client
            .begin_status_flow(
                "1.0",
                Some(LroStatusTestSnapshotsClientBeginStatusFlowOptions {
                    method_options: options(),
                }),
            )
            .unwrap()
            .await
            .is_err());
        assert_eq!(script.requests.lock().unwrap().len(), 2);

        let (client, script) = scripted(&[terminal]);
        assert!(client.begin_monitor("1.0", None).unwrap().await.is_err());
        assert_eq!(script.requests.lock().unwrap().len(), 1);
    }
}

#[tokio::test]
async fn malformed_monitor_status_remains_an_error() {
    for invalid in ["", r#"{"status":42}"#, "{"] {
        let (client, script) = scripted(&[r#"{"status":"provisioning"}"#, invalid]);
        assert!(client
            .begin_status_flow(
                "1.0",
                Some(LroStatusTestSnapshotsClientBeginStatusFlowOptions {
                    method_options: options(),
                }),
            )
            .unwrap()
            .await
            .is_err());
        assert_eq!(script.requests.lock().unwrap().len(), 2);
    }
}
