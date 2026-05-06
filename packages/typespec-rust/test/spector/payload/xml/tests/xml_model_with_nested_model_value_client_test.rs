// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_xml::{
    models::{ModelWithNestedModel, SimpleModel},
    XmlClient,
};

#[tokio::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_nested_model_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithNestedModel = resp.into_model().unwrap();
    let nested = value.nested.unwrap();
    assert_eq!(nested.name, Some("foo".to_string()));
    assert_eq!(nested.age, Some(123));
}

#[tokio::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = ModelWithNestedModel {
        nested: Some(SimpleModel {
            name: Some("foo".to_string()),
            age: Some(123),
        }),
    };
    client
        .get_xml_model_with_nested_model_value_client()
        .put(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
