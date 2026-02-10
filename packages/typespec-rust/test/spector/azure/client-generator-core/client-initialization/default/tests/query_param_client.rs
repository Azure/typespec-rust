// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_clientinit_default::{
    models::{BlobProperties, QueryParamClientWithQueryOptions},
    QueryParamClient,
};
use time::{Date, Month, OffsetDateTime, Time};

#[tokio::test]
async fn delete_standalone() {
    let client = QueryParamClient::with_no_credential(
        "http://localhost:3000",
        "test-blob".to_string(),
        None,
    )
    .unwrap();
    client.delete_standalone(None).await.unwrap();
}

#[tokio::test]
async fn get_standalone() {
    let client = QueryParamClient::with_no_credential(
        "http://localhost:3000",
        "test-blob".to_string(),
        None,
    )
    .unwrap();
    let resp = client.get_standalone(None).await.unwrap();
    let blob_properties: BlobProperties = resp.into_model().unwrap();
    assert_eq!(blob_properties.content_type, Some("text/plain".to_string()));
    assert_eq!(
        blob_properties.created_on,
        Some(OffsetDateTime::new_utc(
            Date::from_calendar_date(2025, Month::April, 1).unwrap(),
            Time::from_hms(12, 0, 0).unwrap(),
        ))
    );
    assert_eq!(blob_properties.name, Some("test-blob".to_string()));
    assert_eq!(blob_properties.size, Some(42));
}

#[tokio::test]
async fn with_query() {
    let client = QueryParamClient::with_no_credential(
        "http://localhost:3000",
        "test-blob".to_string(),
        None,
    )
    .unwrap();
    client
        .with_query(Some(QueryParamClientWithQueryOptions {
            format: Some("text".to_string()),
            ..Default::default()
        }))
        .await
        .unwrap();
}
