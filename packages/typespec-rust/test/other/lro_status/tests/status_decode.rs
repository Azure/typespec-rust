// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use azure_core::http::{
    headers::Headers,
    poller::{PollerStatus, StatusMonitor, StatusResponseKind},
    RawResponse, StatusCode,
};
use lro_status::models::{
    LroStatusTestSnapshotsClientBeginLocationStatusOperationStatus as LocationMonitor,
    LroStatusTestSnapshotsClientBeginNullableStatusOperationStatus as NullableMonitor,
    LroStatusTestSnapshotsClientBeginOptionalStatusOperationStatus as OptionalMonitor,
};
use std::borrow::Cow;

include!(concat!(env!("OUT_DIR"), "/status_decoders.rs"));

#[test]
fn nested_optional_status_borrows_ordinary_strings_and_owns_escaped_strings() {
    type Decoder<'a> =
        LroStatusTestSnapshotsClientBeginOptionalStatusOperationStatusInitialStatusResponse<'a>;
    let plain = br#"{"properties":{"status":"NeedsReview"}}"#;
    let decoded: Decoder<'_> = serde_json::from_slice(plain).unwrap();
    let status = decoded.properties.unwrap().status.unwrap().0;
    assert!(matches!(status, Cow::Borrowed("NeedsReview")));
    assert_eq!(
        status.as_ptr(),
        plain
            .windows(11)
            .find(|value| *value == b"NeedsReview")
            .unwrap()
            .as_ptr(),
    );

    let escaped: Decoder<'_> =
        serde_json::from_slice(br#"{"properties":{"status":"Needs\u0052eview"}}"#).unwrap();
    assert!(matches!(
        escaped.properties.unwrap().status.unwrap().0,
        Cow::Owned(value) if value == "NeedsReview"
    ));

    type Polling<'a> = LroStatusTestSnapshotsClientBeginOptionalStatusOperationStatusOperationLocationStatusResponse<'a>;
    let polling: Polling<'_> = serde_json::from_slice(br#"{"status":"Running"}"#).unwrap();
    assert!(matches!(polling.status.0, Cow::Borrowed("Running")));
}

fn response(body: &'static [u8]) -> RawResponse {
    RawResponse::from_bytes(StatusCode::Ok, Headers::new(), body)
}

#[test]
fn optional_missing_or_null_status_and_parent_are_in_progress() {
    for body in [
        br#"{}"#.as_slice(),
        br#"{"properties":null}"#,
        br#"{"properties":{}}"#,
        br#"{"properties":{"status":null}}"#,
    ] {
        assert_eq!(
            OptionalMonitor::status_from_response(&response(body), StatusResponseKind::Initial)
                .unwrap(),
            Some(PollerStatus::InProgress),
        );
    }
}

#[test]
fn required_nullable_fields_accept_null_but_not_missing_values() {
    for body in [
        br#"{"properties":null}"#.as_slice(),
        br#"{"properties":{"status":null}}"#,
    ] {
        assert_eq!(
            NullableMonitor::status_from_response(&response(body), StatusResponseKind::Initial)
                .unwrap(),
            Some(PollerStatus::InProgress),
        );
    }
    for body in [br#"{}"#.as_slice(), br#"{"properties":{}}"#] {
        assert!(NullableMonitor::status_from_response(
            &response(body),
            StatusResponseKind::Initial
        )
        .is_err(),);
    }
}

#[test]
fn malformed_optional_fields_and_missing_required_fields_remain_errors() {
    for body in [
        br#"{"properties":42}"#.as_slice(),
        br#"{"properties":{"status":42}}"#,
        br#"{"properties":{"status":{}}}"#,
    ] {
        assert!(OptionalMonitor::status_from_response(
            &response(body),
            StatusResponseKind::Initial
        )
        .is_err(),);
    }
    for body in [
        br#"{}"#.as_slice(),
        br#"{"status":null}"#,
        br#"{"status":3}"#,
    ] {
        assert!(OptionalMonitor::status_from_response(
            &response(body),
            StatusResponseKind::OperationLocation,
        )
        .is_err(),);
    }
}

#[test]
fn empty_or_inapplicable_responses_preserve_protocol_fallback() {
    assert_eq!(
        OptionalMonitor::status_from_response(&response(b""), StatusResponseKind::Initial).unwrap(),
        None,
    );
    assert_eq!(
        OptionalMonitor::status_from_response(&response(b"not json"), StatusResponseKind::Location)
            .unwrap(),
        None,
    );
}

#[test]
fn location_uses_polling_shape_and_decodes_escaped_status_strings() {
    assert_eq!(
        LocationMonitor::status_from_response(
            &response(br#"{"initialStatus":"Running"}"#),
            StatusResponseKind::Initial,
        )
        .unwrap(),
        Some(PollerStatus::InProgress),
    );
    assert_eq!(
        LocationMonitor::status_from_response(
            &response(br#"{"status":"Needs\u0052eview"}"#),
            StatusResponseKind::Location,
        )
        .unwrap(),
        Some(PollerStatus::Failed),
    );
    assert!(LocationMonitor::status_from_response(
        &response(br#"{"initialStatus":"NeedsReview"}"#),
        StatusResponseKind::Location,
    )
    .is_err());
}

#[test]
fn identical_wire_strings_have_distinct_phase_and_stable_instance_meanings() {
    assert_eq!(
        LocationMonitor::status_from_response(
            &response(br#"{"initialStatus":"completed"}"#),
            StatusResponseKind::Initial,
        )
        .unwrap(),
        Some(PollerStatus::Failed),
    );
    assert_eq!(
        LocationMonitor::status_from_response(
            &response(br#"{"status":"completed"}"#),
            StatusResponseKind::Location,
        )
        .unwrap(),
        Some(PollerStatus::Succeeded),
    );
    let monitor: LocationMonitor =
        azure_core::json::from_json(br#"{"status":"completed"}"#).unwrap();
    assert_eq!(monitor.status(), PollerStatus::Succeeded);
}
