// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_xml::{
    models::{Author, ModelWithRenamedNestedModel},
    XmlClient,
};

#[tokio::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_renamed_nested_model_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithRenamedNestedModel = resp.into_model().unwrap();
    let author = value.author.unwrap();
    assert_eq!(author.name, Some("foo".to_string()));
}

#[tokio::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = ModelWithRenamedNestedModel {
        author: Some(Author {
            name: Some("foo".to_string()),
        }),
    };
    client
        .get_xml_model_with_renamed_nested_model_value_client()
        .put(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
