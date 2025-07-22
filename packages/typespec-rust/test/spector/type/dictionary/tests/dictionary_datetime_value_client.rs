// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::time::OffsetDateTime;
use spector_dictionary::DictionaryClient;
use time::format_description::well_known::Rfc3339;

// This test is ignored because it does not use the syntax to verify the value received.
// Once users can read datetimes they receive, the tests should be updated and enabled.
#[tokio::test]
#[ignore]
async fn get() {
    let client = DictionaryClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_dictionary_datetime_value_client()
        .get(None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn put() {
    let mut body = std::collections::HashMap::new();
    body.insert(
        "k1".to_string(),
        OffsetDateTime::parse("2022-08-26T18:38:00Z", &Rfc3339).unwrap(),
    );

    let client = DictionaryClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_dictionary_datetime_value_client()
        .put(body.try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}
