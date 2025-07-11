// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_dictionary::DictionaryClient;

#[tokio::test]
async fn get() {
    let client = DictionaryClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_dictionary_duration_value_client()
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

    assert_eq!(vec.len(), 1);
    assert_eq!(vec[0].0, "k1");
    assert_eq!(vec[0].1.clone(), "P123DT22H14M12.011S");
}

#[tokio::test]
async fn put() {
    let mut body = std::collections::HashMap::<String, String>::new();
    body.insert("k1".to_string(), "P123DT22H14M12.011S".to_string());

    let client = DictionaryClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_dictionary_duration_value_client()
        .put(body.try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}
