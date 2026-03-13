// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_client_default_value::{
    models::{
        ClientDefaultValueClientGetHeaderParameterOptions,
        ClientDefaultValueClientGetOperationParameterOptions, ModelWithDefaultValues,
    },
    ClientDefaultValueClient,
};

#[tokio::test]
async fn put_model_property() {
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();

    let body = ModelWithDefaultValues {
        name: Some("test".to_string()),
        ..Default::default()
    };

    let res = client
        .put_model_property(body.try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(res.status(), 200);

    let res = res.into_model().unwrap();
    assert_eq!(res.name, Some("test".to_string()));
    assert_eq!(res.timeout, Some(30));
    assert_eq!(res.tier, Some("standard".to_string()));
    assert_eq!(res.retry, Some(true));
}

#[tokio::test]
async fn get_operation_parameter() {
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();

    let res = client
        .get_operation_parameter(
            "test",
            Some(ClientDefaultValueClientGetOperationParameterOptions {
                page_size: Some(10),              // Supposed to be the default value
                format: Some("json".to_string()), // Supposed to be the default value
                ..Default::default()
            }),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), 204);
}

#[tokio::test]
async fn get_path_parameter() {
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();

    let res = client
        .get_path_parameter(
            "default-segment1", // Supposed to be the default value
            "segment2",
            None,
        )
        .await
        .unwrap();

    assert_eq!(res.status(), 204);
}

#[tokio::test]
async fn get_header_parameter() {
    let client =
        ClientDefaultValueClient::with_no_credential("http://localhost:3000", None).unwrap();

    let res = client
        .get_header_parameter(Some(ClientDefaultValueClientGetHeaderParameterOptions {
            accept: Some("application/json;odata.metadata=none".to_string()), // Supposed to be the default value
            custom_header: Some("default-value".to_string()), // Supposed to be the default value
            ..Default::default()
        }))
        .await
        .unwrap();

    assert_eq!(res.status(), 204);
}
