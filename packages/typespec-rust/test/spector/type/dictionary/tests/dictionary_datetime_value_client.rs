// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_dictionary::DictionaryClient;

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

// This test is ignored because it uses #r syntax which technically allows user to pass the value, but this is
// not the experience we want users to have. Once we enable better syntax, we whould update it and then enable.
#[tokio::test]
#[ignore]
async fn put() {
    let client = DictionaryClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_dictionary_datetime_value_client()
        .put(
            r#"{"k1": "2022-08-26T18:38:00Z"}"#.try_into().unwrap(),
            None,
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}
