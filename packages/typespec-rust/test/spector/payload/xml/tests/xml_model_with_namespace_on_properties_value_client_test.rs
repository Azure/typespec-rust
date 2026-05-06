// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_xml::{models::ModelWithNamespaceOnProperties, XmlClient};

#[tokio::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_namespace_on_properties_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithNamespaceOnProperties = resp.into_model().unwrap();
    assert_eq!(value.id, Some(123));
    assert_eq!(value.title, Some("The Great Gatsby".to_string()));
    assert_eq!(value.author, Some("F. Scott Fitzgerald".to_string()));
}

#[ignore = "https://github.com/Azure/typespec-rust/issues/950"]
#[tokio::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = ModelWithNamespaceOnProperties {
        id: Some(123),
        title: Some("The Great Gatsby".to_string()),
        author: Some("F. Scott Fitzgerald".to_string()),
    };
    client
        .get_xml_model_with_namespace_on_properties_value_client()
        .put(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
