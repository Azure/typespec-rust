use azure_core::{
    http::{
        headers::Headers,
        poller::{PollerOptions, PollerStatus, StatusMonitor},
        AsyncRawResponse, ClientOptions, HttpClient, StatusCode, Transport,
    },
    Result,
};
use lro_status::{
    clients::LroStatusTestClient,
    models::{
        LroStatusTestSnapshotsClientBeginLocationStatusOptions,
        LroStatusTestSnapshotsClientBeginOptionalStatusOptions,
        LroStatusTestSnapshotsClientBeginStatusFlowOptions, Snapshot,
    },
};

#[test]
fn status_monitor_classifies_custom_terminal_wire_values() {
    let monitor: lro_status::models::LroStatusTestSnapshotsClientBeginStatusFlowOperationStatus =
        azure_core::json::from_json(br#"{"status":"NeedsReview"}"#).unwrap();
    assert_eq!(monitor.status(), PollerStatus::Failed);
}
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
        self.requests.lock().unwrap().push((
            request.method().as_str().to_owned(),
            request.url().path().to_owned(),
        ));
        let body = self
            .responses
            .lock()
            .unwrap()
            .pop_front()
            .expect("unexpected HTTP request");
        Ok(AsyncRawResponse::from_bytes(
            StatusCode::Ok,
            Headers::new(),
            body,
        ))
    }
}

#[tokio::test]
async fn polls_unrecognized_statuses_and_fetches_typed_final_output() {
    let scripted_client = Arc::new(ScriptedClient {
        responses: Mutex::new(VecDeque::from([
            r#"{"initialStatus":"NotStarted"}"#,
            r#"{"status":"Running"}"#,
            r#"{"status":"future-state"}"#,
            r#"{"status":"CoMpLeTeD"}"#,
            r#"{"id":"snapshot","status":"completed"}"#,
        ])),
        requests: Mutex::new(Vec::new()),
    });
    let transport = Transport::new(scripted_client.clone());
    let client = LroStatusTestClient::with_no_credential(
        "http://localhost",
        Some(lro_status::clients::LroStatusTestClientOptions {
            client_options: ClientOptions {
                transport: Some(transport),
                ..Default::default()
            },
        }),
    )
    .unwrap()
    .get_lro_status_test_snapshots_client();

    let output = client
        .begin_status_flow(
            "1.0",
            Some(LroStatusTestSnapshotsClientBeginStatusFlowOptions {
                method_options: PollerOptions {
                    frequency: azure_core::time::Duration::seconds(1),
                    ..Default::default()
                },
            }),
        )
        .unwrap()
        .await
        .unwrap();

    let output: Snapshot = output.into_body().json().unwrap();
    assert_eq!(output.id.as_deref(), Some("snapshot"));
    assert_eq!(
        *scripted_client.requests.lock().unwrap(),
        [
            ("PUT".to_owned(), "/snapshots/status-flow".to_owned()),
            ("GET".to_owned(), "/snapshots/status-flow".to_owned()),
            ("GET".to_owned(), "/snapshots/status-flow".to_owned()),
            ("GET".to_owned(), "/snapshots/status-flow".to_owned()),
            ("GET".to_owned(), "/snapshots/status-flow".to_owned()),
        ]
    );
}

fn scripted(
    responses: &[&'static str],
) -> (
    lro_status::clients::LroStatusTestSnapshotsClient,
    Arc<ScriptedClient>,
) {
    let script = Arc::new(ScriptedClient {
        responses: Mutex::new(responses.iter().copied().collect()),
        requests: Mutex::new(Vec::new()),
    });
    let client = LroStatusTestClient::with_no_credential(
        "http://localhost",
        Some(lro_status::clients::LroStatusTestClientOptions {
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

#[tokio::test]
async fn location_polling_selects_the_distinct_monitor_shape() {
    let (client, script) = scripted(&[
        r#"{"initialStatus":"Running"}"#,
        r#"{"status":"completed"}"#,
        r#"{"id":"location","status":"completed"}"#,
    ]);
    let output: Snapshot = client
        .begin_location_status(
            "1.0",
            Some(LroStatusTestSnapshotsClientBeginLocationStatusOptions {
                method_options: PollerOptions {
                    frequency: azure_core::time::Duration::seconds(1),
                    ..Default::default()
                },
            }),
        )
        .unwrap()
        .await
        .unwrap()
        .into_body()
        .json()
        .unwrap();
    assert_eq!(output.id.as_deref(), Some("location"));
    assert!(script.responses.lock().unwrap().is_empty());
}

#[tokio::test]
async fn absent_optional_initial_status_continues_to_polling_and_typed_output() {
    let (client, script) = scripted(&[
        r#"{}"#,
        r#"{"status":"completed"}"#,
        r#"{"id":"optional","status":"completed"}"#,
    ]);
    let output: Snapshot = client
        .begin_optional_status(
            "1.0",
            Some(LroStatusTestSnapshotsClientBeginOptionalStatusOptions {
                method_options: PollerOptions {
                    frequency: azure_core::time::Duration::seconds(1),
                    ..Default::default()
                },
            }),
        )
        .unwrap()
        .await
        .unwrap()
        .into_body()
        .json()
        .unwrap();
    assert_eq!(output.id.as_deref(), Some("optional"));
    assert!(script.responses.lock().unwrap().is_empty());
}
