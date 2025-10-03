// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_valuetypes::{models::DictionaryStringProperty, ValueTypesClient};
use std::collections::HashMap;

#[tokio::test]
async fn get() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_value_types_dictionary_string_client()
        .get(None)
        .await
        .unwrap()
        .into_body()
        .unwrap();
    assert!(resp.property.is_some());
    if let Some(dict) = resp.property {
        assert_eq!(dict.get("k1"), Some(&"hello".to_string()));
        assert_eq!(dict.get("k2"), Some(&"world".to_string()));
    }
}

#[tokio::test]
async fn put() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut dict = HashMap::new();
    dict.insert("k1".to_string(), "hello".to_string());
    dict.insert("k2".to_string(), "world".to_string());

    client
        .get_value_types_dictionary_string_client()
        .put(
            DictionaryStringProperty {
                property: Some(dict),
            }
            .try_into()
            .unwrap(),
            None,
        )
        .await
        .unwrap();
}
