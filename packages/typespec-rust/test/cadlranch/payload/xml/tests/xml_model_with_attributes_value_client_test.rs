// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use cadl_xml::{models::ModelWithAttributes, XmlClient};

#[async_std::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_attributes_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithAttributes = resp.try_into().unwrap();
    assert_eq!(value.enabled, Some(true));
    assert_eq!(value.id1, Some(123));
    assert_eq!(value.id2, Some("foo".to_string()));
}

#[async_std::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut input = ModelWithAttributes::default();
    input.enabled = Some(true);
    input.id1 = Some(123);
    input.id2 = Some("foo".to_string());
    client
        .get_xml_model_with_attributes_value_client()
        .put(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
