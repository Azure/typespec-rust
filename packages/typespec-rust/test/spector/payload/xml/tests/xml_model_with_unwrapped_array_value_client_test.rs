// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_xml::{models::ModelWithUnwrappedArray, XmlClient};

#[async_std::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_unwrapped_array_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithUnwrappedArray = resp.into_body().await.unwrap();
    assert_eq!(
        value.colors,
        Some(vec![
            "red".to_string(),
            "green".to_string(),
            "blue".to_string()
        ])
    );
    assert_eq!(value.counts, Some(vec![1, 2]));
}

#[async_std::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut input = ModelWithUnwrappedArray::default();
    input.colors = Some(vec![
        "red".to_string(),
        "green".to_string(),
        "blue".to_string(),
    ]);
    input.counts = Some(vec![1, 2]);
    client
        .get_xml_model_with_unwrapped_array_value_client()
        .put(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
