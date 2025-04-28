// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_datetime::DatetimeClient;
use time::{Date, Month, OffsetDateTime, Time};

#[tokio::test]
async fn default() {
    let client = DatetimeClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_datetime_query_client()
        .default(
            OffsetDateTime::new_utc(
                Date::from_calendar_date(2022, Month::August, 26).unwrap(),
                Time::from_hms(18, 38, 0).unwrap(),
            ),
            None,
        )
        .await
        .unwrap();
}

#[tokio::test]
async fn rfc3339() {
    let client = DatetimeClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_datetime_query_client()
        .rfc3339(
            OffsetDateTime::new_utc(
                Date::from_calendar_date(2022, Month::August, 26).unwrap(),
                Time::from_hms(18, 38, 0).unwrap(),
            ),
            None,
        )
        .await
        .unwrap();
}

#[tokio::test]
async fn rfc7231() {
    let client = DatetimeClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_datetime_query_client()
        .rfc7231(
            OffsetDateTime::new_utc(
                Date::from_calendar_date(2022, Month::August, 26).unwrap(),
                Time::from_hms(14, 38, 0).unwrap(),
            ),
            None,
        )
        .await
        .unwrap();
}

#[tokio::test]
async fn unix_timestamp() {
    let client = DatetimeClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_datetime_query_client()
        .unix_timestamp(
            OffsetDateTime::new_utc(
                Date::from_calendar_date(2023, Month::June, 12).unwrap(),
                Time::from_hms(10, 47, 44).unwrap(),
            ),
            None,
        )
        .await
        .unwrap();
}

#[tokio::test]
async fn unix_timestamp_array() {
    let client = DatetimeClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_datetime_query_client()
        .unix_timestamp_array(
            &[
                OffsetDateTime::new_utc(
                    Date::from_calendar_date(2023, Month::June, 12).unwrap(),
                    Time::from_hms(10, 47, 44).unwrap(),
                ),
                OffsetDateTime::new_utc(
                    Date::from_calendar_date(2023, Month::June, 14).unwrap(),
                    Time::from_hms(9, 17, 36).unwrap(),
                ),
            ],
            None,
        )
        .await
        .unwrap();
}
