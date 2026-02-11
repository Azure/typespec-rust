// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_clientinit_individually_parent::{
    models::IndividuallyParentIndividuallyParentNestedWithMultipleClientWithQueryOptions,
    IndividuallyParentClient,
};

#[tokio::test]
async fn delete_standalone() {
    let client =
        IndividuallyParentClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_individually_parent_individually_parent_nested_with_multiple_client(
            "test-name-value".to_string(),
            "us-west".to_string(),
        )
        .delete_standalone(None)
        .await
        .unwrap();
}

#[tokio::test]
async fn get_standalone() {
    let client =
        IndividuallyParentClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_individually_parent_individually_parent_nested_with_multiple_client(
            "test-name-value".to_string(),
            "us-west".to_string(),
        )
        .get_standalone(None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_query() {
    let client =
        IndividuallyParentClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_individually_parent_individually_parent_nested_with_multiple_client(
            "test-name-value".to_string(),
            "us-west".to_string(),
        )
        .with_query(Some(
            IndividuallyParentIndividuallyParentNestedWithMultipleClientWithQueryOptions {
                format: Some("text".to_string()),
                ..Default::default()
            },
        ))
        .await
        .unwrap();
}
