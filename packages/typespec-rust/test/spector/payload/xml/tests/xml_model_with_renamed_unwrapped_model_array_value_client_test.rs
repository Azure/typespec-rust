// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_xml::{
    models::{ModelWithRenamedUnwrappedModelArray, SimpleModel},
    XmlClient,
};

#[tokio::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_renamed_unwrapped_model_array_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithRenamedUnwrappedModelArray = resp.into_model().unwrap();
    let items = value.items.unwrap();
    assert_eq!(items.len(), 2);
    assert_eq!(items[0].name, Some("foo".to_string()));
    assert_eq!(items[0].age, Some(123));
    assert_eq!(items[1].name, Some("bar".to_string()));
    assert_eq!(items[1].age, Some(456));
}

#[tokio::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = ModelWithRenamedUnwrappedModelArray {
        items: Some(vec![
            SimpleModel {
                name: Some("foo".to_string()),
                age: Some(123),
            },
            SimpleModel {
                name: Some("bar".to_string()),
                age: Some(456),
            },
        ]),
    };
    client
        .get_xml_model_with_renamed_unwrapped_model_array_value_client()
        .put(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
