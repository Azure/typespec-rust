// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::time::OffsetDateTime;
use spector_datetime::{
    models::{
        DatetimeResponseHeaderClientDefaultResultHeaders,
        DatetimeResponseHeaderClientRfc3339ResultHeaders,
        DatetimeResponseHeaderClientRfc7231ResultHeaders,
        DatetimeResponseHeaderClientUnixTimestampResultHeaders,
    },
    DatetimeClient,
};
use time::{Date, Month, Time};

#[tokio::test]
async fn default() {
    let client = DatetimeClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_datetime_response_header_client()
        .default(None)
        .await
        .unwrap();
    assert_eq!(
        resp.value().unwrap(),
        Some(OffsetDateTime::new_utc(
            Date::from_calendar_date(2022, Month::August, 26).unwrap(),
            Time::from_hms(14, 38, 0).unwrap(),
        ))
    );
}

#[tokio::test]
async fn rfc3339() {
    let client = DatetimeClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_datetime_response_header_client()
        .rfc3339(None)
        .await
        .unwrap();
    assert_eq!(
        resp.value().unwrap(),
        Some(OffsetDateTime::new_utc(
            Date::from_calendar_date(2022, Month::August, 26).unwrap(),
            Time::from_hms(18, 38, 0).unwrap(),
        ))
    )
}

#[tokio::test]
async fn rfc7231() {
    let client = DatetimeClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_datetime_response_header_client()
        .rfc7231(None)
        .await
        .unwrap();
    assert_eq!(
        resp.value().unwrap(),
        Some(OffsetDateTime::new_utc(
            Date::from_calendar_date(2022, Month::August, 26).unwrap(),
            Time::from_hms(14, 38, 0).unwrap(),
        ))
    )
}

#[tokio::test]
async fn unix_timestamp() {
    let client = DatetimeClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_datetime_response_header_client()
        .unix_timestamp(None)
        .await
        .unwrap();
    assert_eq!(
        resp.value().unwrap(),
        Some(OffsetDateTime::new_utc(
            Date::from_calendar_date(2023, Month::June, 12).unwrap(),
            Time::from_hms(10, 47, 44).unwrap(),
        ))
    )
}
