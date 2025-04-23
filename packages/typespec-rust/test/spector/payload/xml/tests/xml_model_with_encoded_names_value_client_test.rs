// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_xml::{
    models::{ModelWithEncodedNames, SimpleModel},
    XmlClient,
};

#[tokio::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_encoded_names_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithEncodedNames = resp.into_body().await.unwrap();
    assert_eq!(
        value.colors,
        Some(vec!["red".to_string(), "green".to_string(), "blue".to_string()])
    );
    let model_data = value.model_data.unwrap();
    assert_eq!(model_data.age, Some(123));
    assert_eq!(model_data.name, Some("foo".to_string()));
}

#[tokio::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = ModelWithEncodedNames {
        colors: Some(vec!["red".to_string(), "green".to_string(), "blue".to_string()]),
        model_data: Some(SimpleModel {
            age: Some(123),
            name: Some("foo".to_string()),
        }),
    };
    client
        .get_xml_model_with_encoded_names_value_client()
        .put(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
