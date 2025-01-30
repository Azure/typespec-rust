// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use std::collections::HashMap;

use spector_xml::{models::ModelWithDictionary, XmlClient};

#[tokio::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_dictionary_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithDictionary = resp.into_body().await.unwrap();
    let metadata = value.metadata.unwrap();
    assert_eq!(metadata.len(), 3);
    assert_eq!(metadata.get("Color"), Some(&"blue".to_string()));
    assert_eq!(metadata.get("Count"), Some(&"123".to_string()));
    assert_eq!(metadata.get("Enabled"), Some(&"false".to_string()));
}

#[tokio::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = ModelWithDictionary {
        metadata: Some(HashMap::from([
            ("Color".to_string(), "blue".to_string()),
            ("Count".to_string(), "123".to_string()),
            ("Enabled".to_string(), "false".to_string()),
        ])),
    };
    client
        .get_xml_model_with_dictionary_value_client()
        .put(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
