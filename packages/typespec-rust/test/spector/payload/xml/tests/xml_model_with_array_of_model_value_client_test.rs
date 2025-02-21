// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_xml::{
    models::{ModelWithArrayOfModel, SimpleModel},
    XmlClient,
};

#[tokio::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_array_of_model_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithArrayOfModel = resp.into_body().await.unwrap();
    let items = value.items;
    assert_eq!(items.len(), 2);
    assert_eq!(items[0].age, Some(123));
    assert_eq!(items[0].name, Some("foo".to_string()));
    assert_eq!(items[1].age, Some(456));
    assert_eq!(items[1].name, Some("bar".to_string()));
}

#[tokio::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();

    let item0 = SimpleModel {
        age: Some(123),
        name: Some("foo".to_string()),
    };

    let item1 = SimpleModel {
        age: Some(456),
        name: Some("bar".to_string()),
    };

    let m = ModelWithArrayOfModel {
        items: vec![item0, item1],
    };

    client
        .get_xml_model_with_array_of_model_value_client()
        .put(m.try_into().unwrap(), None)
        .await
        .unwrap();
}
