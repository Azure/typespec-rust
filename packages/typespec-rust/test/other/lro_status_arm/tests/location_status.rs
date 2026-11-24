use azure_core::{
    credentials::{AccessToken, TokenCredential, TokenRequestOptions},
    http::{
        headers::Headers,
        poller::{
            resource_manager::PollerOptions, PollerStatus, StatusMonitor, StatusResponseKind,
        },
        AsyncRawResponse, ClientOptions, HttpClient, Method, RawResponse, Request, RetryOptions,
        StatusCode, Transport,
    },
    time::{Duration, OffsetDateTime},
    Result,
};
use lro_status_arm::{
    models::{
        LroStatusArmValidationResultsClientBeginCreateOrUpdateOperationStatus,
        LroStatusArmValidationResultsClientBeginCreateOrUpdateOptions, ValidationResult,
    },
    LroStatusArmClient, LroStatusArmClientOptions,
};
use std::{
    collections::VecDeque,
    sync::{Arc, Mutex},
};

#[derive(Debug)]
struct Credential;

#[async_trait::async_trait]
impl TokenCredential for Credential {
    async fn get_token(
        &self,
        scopes: &[&str],
        _: Option<TokenRequestOptions<'_>>,
    ) -> Result<AccessToken> {
        Ok(AccessToken::new(
            scopes.join(" "),
            OffsetDateTime::now_utc() + Duration::hours(1),
        ))
    }
}

struct Step {
    method: Method,
    path: &'static str,
    status: StatusCode,
    body: &'static [u8],
    location: Option<&'static str>,
}

struct Script {
    steps: Mutex<VecDeque<Step>>,
}

impl std::fmt::Debug for Script {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.debug_struct("Script").finish_non_exhaustive()
    }
}

#[async_trait::async_trait]
impl HttpClient for Script {
    async fn execute_request(&self, request: &Request) -> Result<AsyncRawResponse> {
        let step = self
            .steps
            .lock()
            .unwrap()
            .pop_front()
            .expect("unexpected request");
        assert_eq!(request.method(), step.method);
        assert_eq!(request.url().path(), step.path);
        let mut headers = Headers::new();
        headers.insert("retry-after-ms", "0");
        if let Some(location) = step.location {
            headers.insert("location", location);
        }
        Ok(AsyncRawResponse::from_bytes(
            step.status,
            headers,
            step.body,
        ))
    }
}

fn accepted_location() -> Step {
    Step {
        method: Method::Put,
        path: "/subscriptions/sub/resourceGroups/group/providers/LroStatusArm/validationResults/validation",
        status: StatusCode::Accepted,
        body: br#"{"properties":{"status":"Running"}}"#,
        location: Some("/operations/1"),
    }
}

#[test]
fn status_monitor_classifies_custom_terminal_wire_values() {
    type Monitor = LroStatusArmValidationResultsClientBeginCreateOrUpdateOperationStatus;
    let response = RawResponse::from_bytes(
        StatusCode::Ok,
        Headers::new(),
        br#"{"properties":{"status":"NeedsReview"}}"#.as_slice(),
    );
    assert_eq!(
        Monitor::status_from_response(&response, StatusResponseKind::Initial).unwrap(),
        Some(PollerStatus::Failed),
    );
    assert_eq!(
        Monitor::status_from_response(&response, StatusResponseKind::Location).unwrap(),
        Some(PollerStatus::Failed),
    );
    assert_eq!(
        Monitor::status_from_response(&response, StatusResponseKind::OriginalUrl).unwrap(),
        Some(PollerStatus::Failed),
    );
    let monitor: Monitor = azure_core::json::from_json(br#"{"status":"NeedsReview"}"#).unwrap();
    assert_eq!(monitor.status(), PollerStatus::InProgress);
}

fn client(steps: Vec<Step>) -> Result<(LroStatusArmClient, Arc<Script>)> {
    let script = Arc::new(Script {
        steps: Mutex::new(steps.into()),
    });
    let client = LroStatusArmClient::new(
        "sub".into(),
        Arc::new(Credential),
        Some(LroStatusArmClientOptions {
            client_options: ClientOptions {
                transport: Some(Transport::new(script.clone())),
                retry: RetryOptions::none(),
                ..Default::default()
            },
            ..Default::default()
        }),
    )?;
    Ok((client, script))
}

fn options() -> Option<LroStatusArmValidationResultsClientBeginCreateOrUpdateOptions<'static>> {
    Some(
        LroStatusArmValidationResultsClientBeginCreateOrUpdateOptions {
            method_options: PollerOptions {
                frequency: Duration::seconds(1),
                ..Default::default()
            },
        },
    )
}

fn begin(client: &LroStatusArmClient) -> Result<azure_core::http::Poller<
    lro_status_arm::models::LroStatusArmValidationResultsClientBeginCreateOrUpdateOperationStatus,
>>{
    client
        .get_lro_status_arm_validation_results_client()
        .begin_create_or_update(
            "group",
            "validation",
            ValidationResult::default().try_into()?,
            options(),
        )
}

#[tokio::test]
async fn location_status_uses_generated_nested_custom_failure_mapping() -> Result<()> {
    let (client, script) = client(vec![
        accepted_location(),
        Step {
            method: Method::Get,
            path: "/operations/1",
            status: StatusCode::Accepted,
            body: b"",
            location: None,
        },
        Step {
            method: Method::Get,
            path: "/operations/1",
            status: StatusCode::Ok,
            body: br#"{"properties":{"status":"NeedsReview"}}"#,
            location: None,
        },
    ])?;

    assert!(begin(&client).unwrap().await.is_err());
    assert!(script.steps.lock().unwrap().is_empty());
    Ok(())
}

#[tokio::test]
async fn location_status_accepts_custom_success_after_preserving_accepted_continuation(
) -> Result<()> {
    let (client, script) = client(vec![
        accepted_location(),
        Step {
            method: Method::Get,
            path: "/operations/1",
            status: StatusCode::Accepted,
            body: b"",
            location: None,
        },
        Step {
            method: Method::Get,
            path: "/operations/1",
            status: StatusCode::Ok,
            body: br#"{"id":"id","name":"validation","properties":{"status":"Succeeded"}}"#,
            location: None,
        },
    ])?;

    let result = begin(&client).unwrap().await?.into_model()?;
    assert_eq!(result.name.as_deref(), Some("validation"));
    assert!(script.steps.lock().unwrap().is_empty());
    Ok(())
}

#[tokio::test]
async fn location_status_treats_unknown_values_as_in_progress() -> Result<()> {
    let (client, script) = client(vec![
        accepted_location(),
        Step {
            method: Method::Get,
            path: "/operations/1",
            status: StatusCode::Accepted,
            body: b"",
            location: None,
        },
        Step {
            method: Method::Get,
            path: "/operations/1",
            status: StatusCode::Ok,
            body: br#"{"properties":{"status":"future-state"}}"#,
            location: None,
        },
        Step {
            method: Method::Get,
            path: "/operations/1",
            status: StatusCode::Ok,
            body: br#"{"id":"id","name":"validation","properties":{"status":"Succeeded"}}"#,
            location: None,
        },
    ])?;

    let result = begin(&client).unwrap().await?.into_model()?;
    assert_eq!(result.name.as_deref(), Some("validation"));
    assert!(script.steps.lock().unwrap().is_empty());
    Ok(())
}

#[tokio::test]
async fn missing_optional_parent_does_not_finish_on_http_200() -> Result<()> {
    let (client, script) = client(vec![
        accepted_location(),
        Step {
            method: Method::Get,
            path: "/operations/1",
            status: StatusCode::Ok,
            body: b"{}",
            location: None,
        },
        Step {
            method: Method::Get,
            path: "/operations/1",
            status: StatusCode::Ok,
            body: br#"{"id":"id","name":"validation","properties":{"status":"Succeeded"}}"#,
            location: None,
        },
    ])?;
    let result = begin(&client).unwrap().await?.into_model()?;
    assert_eq!(result.name.as_deref(), Some("validation"));
    assert!(script.steps.lock().unwrap().is_empty());
    Ok(())
}
