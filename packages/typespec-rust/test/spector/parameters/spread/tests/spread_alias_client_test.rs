// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_spread::{
    alias::models::SpreadAliasClientSpreadWithMultipleParametersOptions, SpreadClient,
};

#[tokio::test]
async fn spread_as_request_body() {
    let client = SpreadClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_spread_alias_client()
        .spread_as_request_body("foo".to_string(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn spread_as_request_parameter() {
    let client = SpreadClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_spread_alias_client()
        .spread_as_request_parameter("1", "bar".to_string(), "foo".to_string(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn spread_parameter_with_inner_alias() {
    let client = SpreadClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_spread_alias_client()
        .spread_parameter_with_inner_alias("1", "foo".to_string(), 1, "bar".to_string(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn spread_parameter_with_inner_model() {
    let client = SpreadClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_spread_alias_client()
        .spread_parameter_with_inner_model("1", "foo".to_string(), "bar".to_string(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn spread_with_multiple_parameters() {
    let client = SpreadClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_spread_alias_client()
        .spread_with_multiple_parameters(
            "1",
            "bar".to_string(),
            "foo".to_string(),
            vec![1, 2],
            Some(SpreadAliasClientSpreadWithMultipleParametersOptions {
                optional_int: Some(1),
                optional_string_list: Some(vec!["foo".to_string(), "bar".to_string()]),
                ..Default::default()
            }),
        )
        .await
        .unwrap();
}
