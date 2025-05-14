// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_clientinit::{models::WithBodyRequest, MixedParamsClient};

#[tokio::test]
async fn with_body() {
    let client = MixedParamsClient::with_no_credential(
        "http://localhost:3000",
        "test-name-value".to_string(),
        None,
    )
    .unwrap();
    let body = WithBodyRequest {
        name: Some("test-name".to_string()),
    };
    client
        .with_body("us-west", body.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_query() {
    let client = MixedParamsClient::with_no_credential(
        "http://localhost:3000",
        "test-name-value".to_string(),
        None,
    )
    .unwrap();
    client.with_query("us-west", "test-id", None).await.unwrap();
}
