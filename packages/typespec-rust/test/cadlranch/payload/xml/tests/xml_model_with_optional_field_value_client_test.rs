// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use cadl_xml::{models::ModelWithOptionalField, XmlClient};

#[async_std::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_optional_field_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithOptionalField = resp.into_body().await.unwrap();
    assert_eq!(value.item, Some("widget".to_string()));
    assert_eq!(value.value, None);
}

#[async_std::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut input = ModelWithOptionalField::default();
    input.item = Some("widget".to_string());
    client
        .get_xml_model_with_optional_field_value_client()
        .put(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
