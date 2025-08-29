// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::http::RequestContent;
use spector_coreusage::{
    models::{InputModel, OutputModel, RoundTripModel},
    UsageClient,
};

#[tokio::test]
async fn input_to_input_output() {
    let client = UsageClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = InputModel {
        name: Some("Madge".to_string()),
    };
    client
        .get_usage_model_in_operation_client()
        .input_to_input_output(body.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn model_in_read_only_property() {
    let client = UsageClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_usage_model_in_operation_client()
        .model_in_read_only_property(RoundTripModel::default().try_into().unwrap(), None)
        .await
        .unwrap();
    let res: RoundTripModel = resp.into_body().await.unwrap();
    assert_eq!(res.result.unwrap().name, Some("Madge".to_string()));
}

#[tokio::test]
async fn orphan_model_serializable() {
    let client = UsageClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_usage_model_in_operation_client()
        .orphan_model_serializable(
            RequestContent::from_str(r#"{"name": "name", "desc": "desc"}"#),
            None,
        )
        .await
        .unwrap();
}

#[tokio::test]
async fn output_to_input_output() {
    let client = UsageClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_usage_model_in_operation_client()
        .output_to_input_output(None)
        .await
        .unwrap();
    let res: OutputModel = resp.into_body().await.unwrap();
    assert_eq!(res.name, Some("Madge".to_string()));
}
