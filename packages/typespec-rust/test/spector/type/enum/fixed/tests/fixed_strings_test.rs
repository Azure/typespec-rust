// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_fixed::models::DaysOfWeekEnum;
use spector_fixed::FixedClient;

#[tokio::test]
async fn get_known_value() {
    let client = FixedClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_fixed_string_client()
        .get_known_value(None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    let value: DaysOfWeekEnum = resp.into_model().unwrap();
    assert_eq!(value, DaysOfWeekEnum::Monday);
}

#[tokio::test]
async fn put_known_value() {
    let client = FixedClient::with_no_credential("http://localhost:3000", None).unwrap();
    let req = DaysOfWeekEnum::Monday.try_into().unwrap();
    let resp = client
        .get_fixed_string_client()
        .put_known_value(req, None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}

#[tokio::test]
#[ignore]
async fn put_unknown_value() {
    // can't send an arbitrary value for fixed enums in Rust
}
