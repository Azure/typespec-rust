// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_xml::{models::SimpleModel, XmlClient};

#[tokio::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_simple_model_value_client()
        .get(None)
        .await
        .unwrap();
    let value: SimpleModel = resp.into_body().unwrap();
    assert_eq!(value.age, Some(123));
    assert_eq!(value.name, Some("foo".to_string()));
}

#[tokio::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = SimpleModel {
        age: Some(123),
        name: Some("foo".to_string()),
    };
    client
        .get_xml_simple_model_value_client()
        .put(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
