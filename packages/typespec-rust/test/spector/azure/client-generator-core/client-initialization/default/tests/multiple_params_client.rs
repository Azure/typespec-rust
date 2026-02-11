// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_clientinit_default::{models::Input, MultipleParamsClient};

#[tokio::test]
async fn with_body() {
    let client = MultipleParamsClient::with_no_credential(
        "http://localhost:3000",
        "test-name-value".to_string(),
        "us-west".to_string(),
        None,
    )
    .unwrap();
    let body = Input {
        name: Some("test-name".to_string()),
    };
    client
        .with_body(body.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_query() {
    let client = MultipleParamsClient::with_no_credential(
        "http://localhost:3000",
        "test-name-value".to_string(),
        "us-west".to_string(),
        None,
    )
    .unwrap();
    client.with_query("test-id", None).await.unwrap();
}
