// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_dictionary::DictionaryClient;

#[tokio::test]
async fn get() {
    let client = DictionaryClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_dictionary_boolean_value_client()
        .get(None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    let mut vec = resp
        .into_body()
        .await
        .unwrap()
        .into_iter()
        .collect::<Vec<_>>();
    vec.sort_by_key(|p| p.0.clone());

    assert_eq!(vec.len(), 2);
    assert_eq!(vec[0].0, "k1");
    assert!(vec[0].1);
    assert_eq!(vec[1].0, "k2");
    assert!(!vec[1].1);
}

// This test is ignored because it uses #r syntax which technically allows user to pass the value, but this is
// not the experience we want users to have. Once we enable better syntax, we whould update it and then enable.
#[tokio::test]
#[ignore]
async fn put() {
    let client = DictionaryClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_dictionary_boolean_value_client()
        .put(r#"{"k1": true, "k2": false}"#.try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}
