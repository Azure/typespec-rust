// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use cadl_xml::{models::ModelWithText, XmlClient};

#[async_std::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_text_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithText = resp.try_into().unwrap();
    // TODO: revisit. expected "\n  This is some text.\n"
    assert_eq!(value.content, Some("This is some text.".to_string()));
    assert_eq!(value.language, Some("foo".to_string()));
}

#[async_std::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut input = ModelWithText::default();
    input.content = Some("\n  This is some text.\n".to_string());
    input.language = Some("foo".to_string());
    client
        .get_xml_model_with_text_value_client()
        .put(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
