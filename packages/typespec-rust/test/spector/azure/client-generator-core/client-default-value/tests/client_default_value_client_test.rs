// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_clientdefault::ClientDefaultValueClient;

// --- Header parameter tests ---

#[tokio::test]
#[ignore] // Blocked by codegen bug: https://github.com/Azure/typespec-rust/issues/898
async fn get_header_parameter_returns_204() {
    // TODO: This test requires @clientDefaultValue support for header parameters.
    // Once the emitter auto-applies default values for accept and custom_header,
    // remove #[ignore] and verify get_header_parameter(None) returns 204.
}

#[tokio::test]
#[ignore] // Blocked by codegen bug: https://github.com/Azure/typespec-rust/issues/898
async fn get_header_parameter_with_custom_accept() {
    // TODO: This test requires @clientDefaultValue support for header parameters.
    // Once the emitter populates default accept header values, remove #[ignore] and implement.
}

#[tokio::test]
#[ignore] // Blocked by codegen bug: https://github.com/Azure/typespec-rust/issues/898
async fn get_header_parameter_with_custom_header() {
    // TODO: This test requires @clientDefaultValue support for header parameters.
    // Once the emitter populates default custom_header values, remove #[ignore] and implement.
}

// --- Operation parameter tests ---

#[tokio::test]
#[ignore] // Blocked by codegen bug: https://github.com/Azure/typespec-rust/issues/898
async fn get_operation_parameter_returns_204() {
    // TODO: This test requires @clientDefaultValue support for query parameters.
    // Once the emitter auto-applies default values for format and page_size,
    // remove #[ignore] and verify get_operation_parameter("test", None) returns 204.
}

#[tokio::test]
#[ignore] // Blocked by codegen bug: https://github.com/Azure/typespec-rust/issues/898
async fn get_operation_parameter_with_optional_params() {
    // TODO: This test requires @clientDefaultValue support for query parameters.
    // Once the emitter populates default query parameter values, remove #[ignore] and implement.
}

// --- Path parameter tests ---

#[tokio::test]
async fn get_path_parameter_returns_204() {
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_path_parameter("default-segment1", "segment2", None)
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
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();
    let result = client.get_path_parameter("", "segment2", None).await;
    assert!(result.is_err(), "empty segment1 should be rejected");
}

#[tokio::test]
async fn get_path_parameter_rejects_empty_segment2() {
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();
    let result = client
        .get_path_parameter("default-segment1", "", None)
        .await;
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
#[ignore] // Blocked by codegen bug: https://github.com/Azure/typespec-rust/issues/898
async fn put_model_property_returns_200_with_matching_values() {
    // TODO: This test requires @clientDefaultValue support for model properties.
    // Once the emitter generates Default impls that pre-populate retry, tier, and
    // timeout with their declared defaults, remove #[ignore] and implement.
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
