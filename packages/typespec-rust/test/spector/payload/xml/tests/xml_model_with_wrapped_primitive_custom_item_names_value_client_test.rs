// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_xml::{models::ModelWithWrappedPrimitiveCustomItemNames, XmlClient};

#[ignore = "https://github.com/Azure/typespec-rust/issues/951"]
#[tokio::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_wrapped_primitive_custom_item_names_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithWrappedPrimitiveCustomItemNames = resp.into_model().unwrap();
    let tags = value.tags.unwrap();
    assert_eq!(tags.len(), 2);
    assert_eq!(tags[0], "fiction");
    assert_eq!(tags[1], "classic");
}

#[ignore = "https://github.com/Azure/typespec-rust/issues/951"]
#[tokio::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = ModelWithWrappedPrimitiveCustomItemNames {
        tags: Some(vec!["fiction".to_string(), "classic".to_string()]),
    };
    client
        .get_xml_model_with_wrapped_primitive_custom_item_names_value_client()
        .put(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
