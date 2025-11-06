// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::time::OffsetDateTime;
use spector_valuetypes::{models::DatetimeProperty, ValueTypesClient};

#[tokio::test]
async fn get() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_value_types_datetime_client()
        .get(None)
        .await
        .unwrap()
        .into_model()
        .unwrap();
    let datetime = OffsetDateTime::parse(
        "2022-08-26T18:38:00Z",
        &time::format_description::well_known::Rfc3339,
    )
    .unwrap();
    assert_eq!(resp.property, Some(datetime));
}

#[tokio::test]
async fn put() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    // Parse the datetime string from the mockapi
    let datetime = OffsetDateTime::parse(
        "2022-08-26T18:38:00Z",
        &time::format_description::well_known::Rfc3339,
    )
    .unwrap();
    client
        .get_value_types_datetime_client()
        .put(
            DatetimeProperty {
                property: Some(datetime),
            }
            .try_into()
            .unwrap(),
            None,
        )
        .await
        .unwrap();
}
