// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_clientinit_individually::{
    models::IndividuallyNestedWithMultipleClientWithQueryOptions,
    IndividuallyNestedWithMultipleClient,
};

#[tokio::test]
async fn delete_standalone() {
    let client = IndividuallyNestedWithMultipleClient::with_no_credential(
        "http://localhost:3000",
        "test-name-value".to_string(),
        "us-west".to_string(),
        None,
    )
    .unwrap();
    client.delete_standalone(None).await.unwrap();
}

#[tokio::test]
async fn get_standalone() {
    let client = IndividuallyNestedWithMultipleClient::with_no_credential(
        "http://localhost:3000",
        "test-name-value".to_string(),
        "us-west".to_string(),
        None,
    )
    .unwrap();
    client.get_standalone(None).await.unwrap();
}

#[tokio::test]
async fn with_query() {
    let client = IndividuallyNestedWithMultipleClient::with_no_credential(
        "http://localhost:3000",
        "test-name-value".to_string(),
        "us-west".to_string(),
        None,
    )
    .unwrap();
    client
        .with_query(Some(IndividuallyNestedWithMultipleClientWithQueryOptions {
            format: Some("text".to_string()),
            ..Default::default()
        }))
        .await
        .unwrap();
}
