// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_datetime::{
    models::{
        DefaultDatetimeProperty, Rfc3339DatetimeProperty, Rfc7231DatetimeProperty,
        UnixTimestampDatetimeProperty,
    },
    DatetimeClient,
};
use time::{Date, Month, OffsetDateTime, Time};

#[tokio::test]
async fn default() {
    let client = DatetimeClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut body = DefaultDatetimeProperty::default();
    let odt_utc = OffsetDateTime::new_utc(
        Date::from_calendar_date(2022, Month::August, 26).unwrap(),
        Time::from_hms(18, 38, 0).unwrap(),
    );
    body.value = Some(odt_utc);
    let resp = client
        .get_datetime_property_client()
        .default(body.try_into().unwrap(), None)
        .await
        .unwrap();
    let value: DefaultDatetimeProperty = resp.into_body().await.unwrap();
    assert_eq!(value.value, Some(odt_utc));
}

#[tokio::test]
async fn rfc3339() {
    let client = DatetimeClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut body = Rfc3339DatetimeProperty::default();
    let odt_utc = OffsetDateTime::new_utc(
        Date::from_calendar_date(2022, Month::August, 26).unwrap(),
        Time::from_hms(18, 38, 0).unwrap(),
    );
    body.value = Some(odt_utc);
    let resp = client
        .get_datetime_property_client()
        .rfc3339(body.try_into().unwrap(), None)
        .await
        .unwrap();
    let value: Rfc3339DatetimeProperty = resp.into_body().await.unwrap();
    assert_eq!(value.value, Some(odt_utc));
}

#[tokio::test]
async fn rfc7231() {
    let client = DatetimeClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut body = Rfc7231DatetimeProperty::default();
    let odt_utc = OffsetDateTime::new_utc(
        Date::from_calendar_date(2022, Month::August, 26).unwrap(),
        Time::from_hms(14, 38, 0).unwrap(),
    );
    body.value = Some(odt_utc);
    let resp = client
        .get_datetime_property_client()
        .rfc7231(body.try_into().unwrap(), None)
        .await
        .unwrap();
    let value: Rfc7231DatetimeProperty = resp.into_body().await.unwrap();
    assert_eq!(value.value, Some(odt_utc));
}

#[tokio::test]
async fn unix_timestamp() {
    let client = DatetimeClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut body = UnixTimestampDatetimeProperty::default();
    let odt_utc = OffsetDateTime::new_utc(
        Date::from_calendar_date(2023, Month::June, 12).unwrap(),
        Time::from_hms(10, 47, 44).unwrap(),
    );
    body.value = Some(odt_utc);
    let resp = client
        .get_datetime_property_client()
        .unix_timestamp(body.try_into().unwrap(), None)
        .await
        .unwrap();
    let value: UnixTimestampDatetimeProperty = resp.into_body().await.unwrap();
    assert_eq!(value.value, Some(odt_utc));
}

#[tokio::test]
async fn unix_timestamp_array() {
    // TODO
}
