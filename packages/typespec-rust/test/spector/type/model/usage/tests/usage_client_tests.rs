// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_usage::models::{InputOutputRecord, InputRecord, OutputRecord};
use spector_usage::UsageClient;

#[tokio::test]
async fn input() {
    let client = UsageClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input_record = InputRecord {
        required_prop: Some(String::from("example-value")),
    };
    let req = input_record.try_into().unwrap();
    let _resp = client.input(req, None).await.unwrap();
}

#[tokio::test]
async fn input_and_output() {
    let client = UsageClient::with_no_credential("http://localhost:3000", None).unwrap();
    let io_record = InputOutputRecord {
        required_prop: Some(String::from("example-value")),
    };
    let req = io_record.try_into().unwrap();
    let resp = client.input_and_output(req, None).await.unwrap();
    let value: InputOutputRecord = resp.into_body().await.unwrap();
    assert_eq!(value.required_prop, Some(String::from("example-value")));
}

#[tokio::test]
async fn output() {
    let client = UsageClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client.output(None).await.unwrap();
    let value: OutputRecord = resp.into_body().await.unwrap();
    assert_eq!(value.required_prop, Some(String::from("example-value")));
}
