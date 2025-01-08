// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_xml::{
    models::{ModelWithRenamedFields, SimpleModel},
    XmlClient,
};

#[tokio::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_renamed_fields_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithRenamedFields = resp.into_body().await.unwrap();
    let input_data = value.input_data.unwrap();
    assert_eq!(input_data.age, Some(123));
    assert_eq!(input_data.name, Some("foo".to_string()));
    let output_data = value.output_data.unwrap();
    assert_eq!(output_data.age, Some(456));
    assert_eq!(output_data.name, Some("bar".to_string()));
}

#[tokio::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut input_data = SimpleModel::default();
    input_data.age = Some(123);
    input_data.name = Some("foo".to_string());
    let mut output_data = SimpleModel::default();
    output_data.age = Some(456);
    output_data.name = Some("bar".to_string());
    let mut input = ModelWithRenamedFields::default();
    input.input_data = Some(input_data);
    input.output_data = Some(output_data);
    client
        .get_xml_model_with_renamed_fields_value_client()
        .put(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
