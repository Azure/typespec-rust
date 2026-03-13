// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_access::{
    public_operation::models::{NoDecoratorModelInPublic, PublicDecoratorModelInPublic},
    shared_model_in_operation::models::SharedModel,
    AccessClient,
};

#[tokio::test]
async fn client_endpoint_is_stored() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    assert_eq!(client.endpoint().as_str(), "http://localhost:3000/");
}

#[tokio::test]
async fn client_rejects_malformed_url() {
    let result = AccessClient::with_no_credential("not-a-valid-url", None);
    assert!(result.is_err(), "malformed URL should be rejected");
}

#[tokio::test]
async fn client_rejects_non_http_scheme() {
    let result = AccessClient::with_no_credential("ftp://localhost:3000", None);
    assert!(result.is_err(), "non-http scheme should be rejected");
}

#[tokio::test]
async fn no_decorator_in_public_returns_200_with_name() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_access_public_operation_client()
        .no_decorator_in_public("sample", None)
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        200,
        "no_decorator_in_public should return 200 OK"
    );
    let model: NoDecoratorModelInPublic = resp.into_model().unwrap();
    assert_eq!(
        model.name,
        Some("sample".to_string()),
        "name should match the query parameter"
    );
}

#[tokio::test]
async fn public_decorator_in_public_returns_200_with_name() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_access_public_operation_client()
        .public_decorator_in_public("sample", None)
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        200,
        "public_decorator_in_public should return 200 OK"
    );
    let model: PublicDecoratorModelInPublic = resp.into_model().unwrap();
    assert_eq!(
        model.name,
        Some("sample".to_string()),
        "name should match the query parameter"
    );
}

#[tokio::test]
async fn shared_model_public_returns_200_with_name() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_access_shared_model_in_operation_client()
        .public("sample", None)
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        200,
        "shared model public should return 200 OK"
    );
    let model: SharedModel = resp.into_model().unwrap();
    assert_eq!(
        model.name,
        Some("sample".to_string()),
        "name should match the query parameter"
    );
}
