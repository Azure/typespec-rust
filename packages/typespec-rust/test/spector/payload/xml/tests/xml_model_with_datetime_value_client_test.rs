// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::time::OffsetDateTime;
use spector_xml::{models::ModelWithDatetime, XmlClient};

#[tokio::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_datetime_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithDatetime = resp.into_model().unwrap();
    // rfc3339: "2022-08-26T18:38:00.000Z"
    let rfc3339 = value.rfc3339.unwrap();
    assert_eq!(
        rfc3339,
        OffsetDateTime::from_unix_timestamp(1661539080).unwrap()
    );
    // rfc7231: "Fri, 26 Aug 2022 14:38:00 GMT"
    let rfc7231 = value.rfc7231.unwrap();
    assert_eq!(
        rfc7231,
        OffsetDateTime::from_unix_timestamp(1661524680).unwrap()
    );
}

#[tokio::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = ModelWithDatetime {
        rfc3339: Some(OffsetDateTime::from_unix_timestamp(1661539080).unwrap()),
        rfc7231: Some(OffsetDateTime::from_unix_timestamp(1661524680).unwrap()),
    };
    client
        .get_xml_model_with_datetime_value_client()
        .put(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
