// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_clientinit_individually::{
    models::IndividuallyNestedWithHeaderClientWithQueryOptions, IndividuallyNestedWithHeaderClient,
};

#[tokio::test]
async fn delete_standalone() {
    let client = IndividuallyNestedWithHeaderClient::with_no_credential(
        "http://localhost:3000",
        "test-name-value".to_string(),
        None,
    )
    .unwrap();
    client.delete_standalone(None).await.unwrap();
}

#[tokio::test]
async fn get_standalone() {
    let client = IndividuallyNestedWithHeaderClient::with_no_credential(
        "http://localhost:3000",
        "test-name-value".to_string(),
        None,
    )
    .unwrap();
    client.get_standalone(None).await.unwrap();
}

#[tokio::test]
async fn with_query() {
    let client = IndividuallyNestedWithHeaderClient::with_no_credential(
        "http://localhost:3000",
        "test-name-value".to_string(),
        None,
    )
    .unwrap();
    client
        .with_query(Some(IndividuallyNestedWithHeaderClientWithQueryOptions {
            format: Some("text".to_string()),
            ..Default::default()
        }))
        .await
        .unwrap();
}
