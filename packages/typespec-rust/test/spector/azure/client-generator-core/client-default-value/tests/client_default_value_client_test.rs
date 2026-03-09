// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_clientdefault::{
    models::{
        ClientDefaultValueClientGetHeaderParameterOptions,
        ClientDefaultValueClientGetOperationParameterOptions, ModelWithDefaultValues,
    },
    ClientDefaultValueClient,
};

// --- Header parameter tests ---

#[tokio::test]
async fn get_header_parameter_returns_204() {
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client.get_header_parameter(None).await.unwrap();
    assert_eq!(
        resp.status(),
        204,
        "get_header_parameter should return 204 No Content"
    );
}

#[tokio::test]
async fn get_header_parameter_with_custom_accept() {
    // Verify custom accept header can be set via options.
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();
    let options = ClientDefaultValueClientGetHeaderParameterOptions {
        accept: Some("application/json".to_string()),
        ..Default::default()
    };
    let resp = client.get_header_parameter(Some(options)).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn get_header_parameter_with_custom_header() {
    // Verify custom x-custom-header can be set via options.
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();
    let options = ClientDefaultValueClientGetHeaderParameterOptions {
        custom_header: Some("custom-value".to_string()),
        ..Default::default()
    };
    let resp = client.get_header_parameter(Some(options)).await.unwrap();
    assert_eq!(resp.status(), 204);
}

// --- Operation parameter tests ---

#[tokio::test]
async fn get_operation_parameter_returns_204() {
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_operation_parameter("sample", None)
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        204,
        "get_operation_parameter should return 204 No Content"
    );
}

#[tokio::test]
async fn get_operation_parameter_with_optional_params() {
    // Verify optional query parameters (format, pageSize) can be set.
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();
    let options = ClientDefaultValueClientGetOperationParameterOptions {
        format: Some("json".to_string()),
        page_size: Some(10),
        ..Default::default()
    };
    let resp = client
        .get_operation_parameter("sample", Some(options))
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}

// --- Path parameter tests ---

#[tokio::test]
async fn get_path_parameter_returns_204() {
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_path_parameter("seg1", "seg2", None)
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        204,
        "get_path_parameter should return 204 No Content"
    );
}

#[tokio::test]
async fn get_path_parameter_rejects_empty_segment1() {
    // The generated client explicitly checks for empty path parameters.
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();
    let result = client.get_path_parameter("", "seg2", None).await;
    assert!(result.is_err(), "empty segment1 should be rejected");
}

#[tokio::test]
async fn get_path_parameter_rejects_empty_segment2() {
    // The generated client explicitly checks for empty path parameters.
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();
    let result = client.get_path_parameter("seg1", "", None).await;
    assert!(result.is_err(), "empty segment2 should be rejected");
}

#[tokio::test]
async fn get_path_parameter_rejects_both_empty() {
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();
    let result = client.get_path_parameter("", "", None).await;
    assert!(result.is_err(), "both empty segments should be rejected");
}

// --- Model property tests ---

#[tokio::test]
async fn put_model_property_returns_200_with_matching_values() {
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = ModelWithDefaultValues {
        name: Some("test".to_string()),
        retry: Some(true),
        tier: Some("standard".to_string()),
        timeout: Some(30),
    };
    let resp = client
        .put_model_property(input.try_into().unwrap(), None)
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        200,
        "put_model_property should return 200 OK"
    );
    let output: ModelWithDefaultValues = resp.into_model().unwrap();
    assert_eq!(output.name, Some("test".to_string()), "name should match");
    assert_eq!(output.retry, Some(true), "retry should match");
    assert_eq!(
        output.tier,
        Some("standard".to_string()),
        "tier should match"
    );
    assert_eq!(output.timeout, Some(30), "timeout should match");
}

// --- Client construction negative tests ---

#[tokio::test]
async fn client_rejects_non_http_scheme() {
    let result = ClientDefaultValueClient::with_no_credential("ftp://localhost:3000", None);
    assert!(result.is_err(), "non-http scheme should be rejected");
}

#[tokio::test]
async fn client_rejects_malformed_url() {
    let result = ClientDefaultValueClient::with_no_credential("not-a-valid-url", None);
    assert!(result.is_err(), "malformed URL should be rejected");
}
