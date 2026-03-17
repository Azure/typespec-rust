// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_access::{
    internal_operation::{
        clients::AccessInternalOperationClient, models::PublicDecoratorModelInInternal,
    },
    AccessClient,
};

#[tokio::test]
async fn internal_operation_sub_client_can_be_created() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _sub: AccessInternalOperationClient = client.get_access_internal_operation_client();
}

#[tokio::test]
async fn internal_operation_sub_client_endpoint_propagates() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let sub = client.get_access_internal_operation_client();
    assert_eq!(
        sub.endpoint().as_str(),
        "http://localhost:3000/",
        "sub-client endpoint should match the parent endpoint"
    );
}

#[tokio::test]
async fn internal_operation_sub_client_preserves_custom_endpoint() {
    let client = AccessClient::with_no_credential("http://custom-host:8080", None).unwrap();
    let sub = client.get_access_internal_operation_client();
    assert_eq!(
        sub.endpoint().as_str(),
        "http://custom-host:8080/",
        "sub-client should preserve the custom endpoint from the parent"
    );
}

#[tokio::test]
async fn internal_sub_client_from_non_http_scheme_fails() {
    let result = AccessClient::with_no_credential("ftp://localhost:3000", None);
    assert!(
        result.is_err(),
        "creating a client with a non-http scheme should fail"
    );
}

#[tokio::test]
async fn public_decorator_model_in_internal_default_has_none_name() {
    let model = PublicDecoratorModelInInternal::default();
    assert_eq!(
        model.name, None,
        "default PublicDecoratorModelInInternal should have None name"
    );
}

#[tokio::test]
async fn public_decorator_model_in_internal_deserialize_empty_object() {
    let json = r#"{}"#;
    let model: PublicDecoratorModelInInternal = serde_json::from_str(json).unwrap();
    assert_eq!(
        model.name, None,
        "empty JSON object should deserialize to None name"
    );
}

#[tokio::test]
async fn public_decorator_model_in_internal_round_trip_serialization() {
    let json = r#"{"name":"test-value"}"#;
    let model: PublicDecoratorModelInInternal = serde_json::from_str(json).unwrap();
    assert_eq!(
        model.name,
        Some("test-value".to_string()),
        "deserialized name should match JSON input"
    );
    let serialized = serde_json::to_string(&model).unwrap();
    assert_eq!(
        serialized, json,
        "re-serialized JSON should match original input"
    );
}

#[tokio::test]
async fn internal_decorator_in_internal_returns_200() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let sub = client.get_access_internal_operation_client();
    sub.call_internal_decorator_in_internal("sample")
        .await
        .unwrap();
}

#[tokio::test]
async fn no_decorator_in_internal_returns_200() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let sub = client.get_access_internal_operation_client();
    sub.call_no_decorator_in_internal("sample").await.unwrap();
}

#[tokio::test]
async fn public_decorator_in_internal_returns_200() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let sub = client.get_access_internal_operation_client();
    sub.call_public_decorator_in_internal("sample")
        .await
        .unwrap();
}
