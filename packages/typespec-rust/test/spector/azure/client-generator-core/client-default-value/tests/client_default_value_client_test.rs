// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_clientdefault::{models::ModelWithDefaultValues, ClientDefaultValueClient};

#[tokio::test]
async fn get_header_parameter() {
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.get_header_parameter(None).await.unwrap();
}

#[tokio::test]
async fn get_operation_parameter() {
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_operation_parameter("sample", None)
        .await
        .unwrap();
}

#[tokio::test]
async fn get_path_parameter() {
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_path_parameter("seg1", "seg2", None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_model_property() {
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = ModelWithDefaultValues {
        name: Some("test".to_string()),
        retry: Some(true),
        tier: Some("standard".to_string()),
        timeout: Some(30),
    };
    client
        .put_model_property(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
