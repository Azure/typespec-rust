// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_xml::{models::ModelWithNamespace, XmlClient};

#[tokio::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_namespace_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithNamespace = resp.into_model().unwrap();
    assert_eq!(value.id, Some(123));
    assert_eq!(value.title, Some("The Great Gatsby".to_string()));
}

#[tokio::test]
#[ignore = "https://github.com/Azure/typespec-rust/issues/950"]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = ModelWithNamespace {
        id: Some(123),
        title: Some("The Great Gatsby".to_string()),
    };
    client
        .get_xml_model_with_namespace_value_client()
        .put(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
