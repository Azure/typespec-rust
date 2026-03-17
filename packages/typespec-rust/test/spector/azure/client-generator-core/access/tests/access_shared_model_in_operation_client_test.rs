// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_access::{
    shared_model_in_operation::{clients::AccessSharedModelInOperationClient, models::SharedModel},
    AccessClient,
};

#[tokio::test]
async fn shared_model_default_has_none_name() {
    let model = SharedModel::default();
    assert_eq!(
        model.name, None,
        "default SharedModel should have None name"
    );
}

#[tokio::test]
async fn shared_model_deserialize_empty_object() {
    let json = r#"{}"#;
    let model: SharedModel = serde_json::from_str(json).unwrap();
    assert_eq!(
        model.name, None,
        "empty JSON object should deserialize to None name"
    );
}

#[tokio::test]
async fn shared_model_deserialize_null_name() {
    let json = r#"{"name":null}"#;
    let model: SharedModel = serde_json::from_str(json).unwrap();
    assert_eq!(
        model.name, None,
        "null name in JSON should deserialize to None"
    );
}

#[tokio::test]
async fn shared_model_public_returns_200_with_expected_name() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_access_shared_model_in_operation_client()
        .public("sample", None)
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        200,
        "shared model public method should return 200 OK"
    );
    let model: SharedModel = resp.into_model().unwrap();
    assert_eq!(
        model.name,
        Some("sample".to_string()),
        "name should match the query parameter"
    );
}

#[tokio::test]
async fn shared_model_round_trip_serialization() {
    let json = r#"{"name":"round-trip"}"#;
    let model: SharedModel = serde_json::from_str(json).unwrap();
    assert_eq!(
        model.name,
        Some("round-trip".to_string()),
        "deserialized name should match JSON input"
    );
    let serialized = serde_json::to_string(&model).unwrap();
    assert_eq!(
        serialized, json,
        "re-serialized JSON should match original input"
    );
}

#[tokio::test]
async fn shared_model_sub_client_can_be_created() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _sub: AccessSharedModelInOperationClient =
        client.get_access_shared_model_in_operation_client();
}

#[tokio::test]
async fn shared_model_sub_client_endpoint_propagates() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let sub = client.get_access_shared_model_in_operation_client();
    assert_eq!(
        sub.endpoint().as_str(),
        "http://localhost:3000/",
        "sub-client endpoint should match the parent endpoint"
    );
}

#[tokio::test]
async fn shared_model_sub_client_from_non_http_scheme_fails() {
    let result = AccessClient::with_no_credential("ftp://localhost:3000", None);
    assert!(
        result.is_err(),
        "creating a client with a non-http scheme should fail"
    );
}

#[tokio::test]
async fn shared_model_sub_client_preserves_custom_endpoint() {
    let client = AccessClient::with_no_credential("http://custom-host:7070", None).unwrap();
    let sub = client.get_access_shared_model_in_operation_client();
    assert_eq!(
        sub.endpoint().as_str(),
        "http://custom-host:7070/",
        "sub-client should preserve the custom endpoint from the parent"
    );
}

#[tokio::test]
async fn shared_model_internal_returns_200() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let sub = client.get_access_shared_model_in_operation_client();
    sub.call_internal("sample").await.unwrap();
}
