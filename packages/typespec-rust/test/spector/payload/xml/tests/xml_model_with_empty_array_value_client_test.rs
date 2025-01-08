// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_xml::{models::ModelWithEmptyArray, XmlClient};

#[tokio::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_empty_array_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithEmptyArray = resp.into_body().await.unwrap();
    //let items = value.items.unwrap();
    assert!(value.items.is_none());
    //assert_eq!(value.items, None);
}

#[tokio::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut input = ModelWithEmptyArray::default();
    input.items = Some(Vec::new());
    client
        .get_xml_model_with_empty_array_value_client()
        .put(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
