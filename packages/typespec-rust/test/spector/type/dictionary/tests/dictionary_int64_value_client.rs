// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_dictionary::DictionaryClient;

#[tokio::test]
async fn get() {
    let client = DictionaryClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_dictionary_int64_value_client()
        .get(None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    let mut vec = resp.into_body().unwrap().into_iter().collect::<Vec<_>>();
    vec.sort_by_key(|p| p.0.clone());

    assert_eq!(vec.len(), 2);
    assert_eq!(vec[0].0, "k1");
    assert_eq!(vec[0].1.clone(), 9007199254740991i64);
    assert_eq!(vec[1].0, "k2");
    assert_eq!(vec[1].1.clone(), -9007199254740991i64);
}

#[tokio::test]
async fn put() {
    let mut body = std::collections::HashMap::new();
    body.insert("k1".to_string(), 9007199254740991i64);
    body.insert("k2".to_string(), -9007199254740991i64);

    let client = DictionaryClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_dictionary_int64_value_client()
        .put(body.try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}
