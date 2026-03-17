// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_access::{
    relative_model_in_operation::clients::AccessRelativeModelInOperationClient, AccessClient,
};

#[tokio::test]
async fn relative_model_sub_client_can_be_created() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _sub: AccessRelativeModelInOperationClient =
        client.get_access_relative_model_in_operation_client();
}

#[tokio::test]
async fn relative_model_sub_client_endpoint_propagates() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let sub = client.get_access_relative_model_in_operation_client();
    assert_eq!(
        sub.endpoint().as_str(),
        "http://localhost:3000/",
        "sub-client endpoint should match the parent endpoint"
    );
}

#[tokio::test]
async fn relative_model_sub_client_from_empty_url_fails() {
    let result = AccessClient::with_no_credential("", None);
    assert!(
        result.is_err(),
        "creating a client with an empty URL should fail"
    );
}

#[tokio::test]
async fn relative_model_sub_client_from_non_http_scheme_fails() {
    let result = AccessClient::with_no_credential("ftp://localhost:3000", None);
    assert!(
        result.is_err(),
        "creating a client with a non-http scheme should fail"
    );
}

#[tokio::test]
async fn relative_model_sub_client_independent_of_other_sub_clients() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let relative_sub = client.get_access_relative_model_in_operation_client();
    let shared_sub = client.get_access_shared_model_in_operation_client();
    assert_eq!(
        relative_sub.endpoint().as_str(),
        shared_sub.endpoint().as_str(),
        "sibling sub-clients should share the same endpoint"
    );
}

#[tokio::test]
async fn relative_model_sub_client_preserves_custom_endpoint() {
    let client = AccessClient::with_no_credential("http://custom-host:9090", None).unwrap();
    let sub = client.get_access_relative_model_in_operation_client();
    assert_eq!(
        sub.endpoint().as_str(),
        "http://custom-host:9090/",
        "sub-client should preserve the custom endpoint from the parent"
    );
}

#[tokio::test]
async fn relative_model_discriminator_returns_200() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let sub = client.get_access_relative_model_in_operation_client();
    sub.call_discriminator("real").await.unwrap();
}

#[tokio::test]
async fn relative_model_operation_returns_200() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let sub = client.get_access_relative_model_in_operation_client();
    sub.call_operation("Madge").await.unwrap();
}
