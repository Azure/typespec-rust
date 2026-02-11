// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_clientinit_individually_parent::{
    models::{
        BlobProperties, IndividuallyParentIndividuallyParentNestedWithQueryClientWithQueryOptions,
    },
    IndividuallyParentClient,
};
use time::{Date, Month, OffsetDateTime, Time};

#[tokio::test]
async fn delete_standalone() {
    let client =
        IndividuallyParentClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_individually_parent_individually_parent_nested_with_query_client(
            "test-blob".to_string(),
        )
        .delete_standalone(None)
        .await
        .unwrap();
}

#[tokio::test]
async fn get_standalone() {
    let client =
        IndividuallyParentClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_individually_parent_individually_parent_nested_with_query_client(
            "test-blob".to_string(),
        )
        .get_standalone(None)
        .await
        .unwrap();
    let blob_properties: BlobProperties = resp.into_model().unwrap();
    assert_eq!(
        blob_properties.content_type,
        Some("application/octet-stream".to_string())
    );
    assert_eq!(
        blob_properties.created_on,
        Some(OffsetDateTime::new_utc(
            Date::from_calendar_date(2023, Month::January, 1).unwrap(),
            Time::from_hms(12, 0, 0).unwrap(),
        ))
    );
    assert_eq!(blob_properties.name, Some("test-blob".to_string()));
    assert_eq!(blob_properties.size, Some(1024));
}

#[tokio::test]
async fn with_query() {
    let client =
        IndividuallyParentClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_individually_parent_individually_parent_nested_with_query_client(
            "test-blob".to_string(),
        )
        .with_query(Some(
            IndividuallyParentIndividuallyParentNestedWithQueryClientWithQueryOptions {
                format: Some("text".to_string()),
                ..Default::default()
            },
        ))
        .await
        .unwrap();
}
