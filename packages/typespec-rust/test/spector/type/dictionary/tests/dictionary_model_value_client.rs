// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_dictionary::DictionaryClient;

#[tokio::test]
async fn get() {
    let client = DictionaryClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_dictionary_model_value_client()
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
    assert_eq!(vec[0].1.property, Some("hello".to_string()));
    assert!(vec[0].1.children.is_none());
    assert_eq!(vec[1].0, "k2");
    assert_eq!(vec[1].1.property, Some("world".to_string()));
    assert!(vec[1].1.children.is_none());
}

#[tokio::test]
async fn put() {
    let client = DictionaryClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_dictionary_model_value_client()
        .put(
            r#"{"k1": {"property": "hello"}, "k2": {"property": "world"}}"#
                .try_into()
                .unwrap(),
            None,
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}
