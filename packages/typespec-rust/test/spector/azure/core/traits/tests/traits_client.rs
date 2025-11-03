// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::time::OffsetDateTime;
use spector_coretraits::{
    models::{TraitsClientRepeatableActionOptions, TraitsClientSmokeTestOptions, UserActionParam},
    TraitsClient,
};
use time::{Date, Month, Time};

#[tokio::test]
async fn repeatable_action() {
    let client = TraitsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = UserActionParam {
        user_action_value: Some("test".to_string()),
    };
    let sent_time = OffsetDateTime::new_utc(
        Date::from_calendar_date(2023, Month::November, 27).unwrap(),
        Time::from_hms(11, 58, 0).unwrap(),
    );
    let resp = client
        .repeatable_action(
            1,
            body.try_into().unwrap(),
            Some(TraitsClientRepeatableActionOptions {
                repeatability_first_sent: Some(sent_time),
                repeatability_request_id: Some("86aede1f-96fa-4e7f-b1e1-bf8a947cb804".to_string()),
                ..Default::default()
            }),
        )
        .await
        .unwrap();
    let resp = resp.into_body().unwrap();
    assert_eq!(resp.user_action_result, Some("test".to_string()));
}

#[tokio::test]
async fn smoke_test() {
    let client = TraitsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let modified_since = OffsetDateTime::new_utc(
        Date::from_calendar_date(2021, Month::August, 26).unwrap(),
        Time::from_hms(14, 38, 0).unwrap(),
    );
    let unmodified_since = OffsetDateTime::new_utc(
        Date::from_calendar_date(2022, Month::August, 26).unwrap(),
        Time::from_hms(14, 38, 0).unwrap(),
    );
    let resp = client
        .smoke_test(
            1,
            "123".to_string(),
            Some(TraitsClientSmokeTestOptions {
                client_request_id: Some("86aede1f-96fa-4e7f-b1e1-bf8a947cb804".to_string()),
                if_match: Some("\"valid\"".to_string()),
                if_modified_since: Some(modified_since),
                if_none_match: Some("\"invalid\"".to_string()),
                if_unmodified_since: Some(unmodified_since),
                ..Default::default()
            }),
        )
        .await
        .unwrap();
    let resp = resp.into_body().unwrap();
    assert_eq!(resp.id, Some(1));
    assert_eq!(resp.name, Some("Madge".to_string()));
}
