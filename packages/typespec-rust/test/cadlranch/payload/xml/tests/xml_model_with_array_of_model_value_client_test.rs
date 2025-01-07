// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use cadl_xml::{
    models::{ModelWithArrayOfModel, SimpleModel},
    XmlClient,
};

#[async_std::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_array_of_model_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithArrayOfModel = resp.into_body().await.unwrap();
    let items = value.items.unwrap();
    assert_eq!(items.len(), 2);
    assert_eq!(items[0].age, Some(123));
    assert_eq!(items[0].name, Some("foo".to_string()));
    assert_eq!(items[1].age, Some(456));
    assert_eq!(items[1].name, Some("bar".to_string()));
}

#[async_std::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();

    let mut item0 = SimpleModel::default();
    item0.age = Some(123);
    item0.name = Some("foo".to_string());

    let mut item1 = SimpleModel::default();
    item1.age = Some(456);
    item1.name = Some("bar".to_string());

    let mut m = ModelWithArrayOfModel::default();
    m.items = Some(vec![item0, item1]);
    client
        .get_xml_model_with_array_of_model_value_client()
        .put(m.try_into().unwrap(), None)
        .await
        .unwrap();
}
