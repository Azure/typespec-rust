// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_spread::{models::BodyParameter, SpreadClient};

#[async_std::test]
async fn spread_as_request_body() {
    let client = SpreadClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_spread_model_client()
        .spread_as_request_body("foo".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn spread_composite_request() {
    let client = SpreadClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut body = BodyParameter::default();
    body.name = Some("foo".to_string());
    client
        .get_spread_model_client()
        .spread_composite_request(
            "foo".to_string(),
            "bar".to_string(),
            body.try_into().unwrap(),
            None,
        )
        .await
        .unwrap();
}

#[async_std::test]
async fn spread_composite_request_mix() {
    let client = SpreadClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_spread_model_client()
        .spread_composite_request_mix(
            "foo".to_string(),
            "bar".to_string(),
            "foo".to_string(),
            None,
        )
        .await
        .unwrap();
}

#[async_std::test]
async fn spread_composite_request_only_with_body() {
    let client = SpreadClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut body = BodyParameter::default();
    body.name = Some("foo".to_string());
    client
        .get_spread_model_client()
        .spread_composite_request_only_with_body(body.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn spread_composite_request_without_body() {
    let client = SpreadClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_spread_model_client()
        .spread_composite_request_without_body("foo".to_string(), "bar".to_string(), None)
        .await
        .unwrap();
}
