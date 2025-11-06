// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_extensible::models::DaysOfWeekExtensibleEnum;
use spector_extensible::ExtensibleClient;

#[tokio::test]
async fn get_known_value() {
    let client = ExtensibleClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_extensible_string_client()
        .get_known_value(None)
        .await
        .unwrap();
    let value: DaysOfWeekExtensibleEnum = resp.into_model().unwrap();
    assert_eq!(value, DaysOfWeekExtensibleEnum::Monday);
}

#[tokio::test]
async fn get_unknown_value() {
    let client = ExtensibleClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_extensible_string_client()
        .get_unknown_value(None)
        .await
        .unwrap();
    let value: DaysOfWeekExtensibleEnum = resp.into_model().unwrap();
    assert_eq!(
        value,
        DaysOfWeekExtensibleEnum::UnknownValue("Weekend".to_string())
    );
}

#[tokio::test]
async fn put_known_value() {
    let client = ExtensibleClient::with_no_credential("http://localhost:3000", None).unwrap();
    let req = DaysOfWeekExtensibleEnum::Monday.try_into().unwrap();
    let resp = client
        .get_extensible_string_client()
        .put_known_value(req, None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn put_unknown_value() {
    let client = ExtensibleClient::with_no_credential("http://localhost:3000", None).unwrap();
    let req = DaysOfWeekExtensibleEnum::UnknownValue("Weekend".to_string())
        .try_into()
        .unwrap();
    let resp = client
        .get_extensible_string_client()
        .put_unknown_value(req, None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}
