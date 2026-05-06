// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_xml::{
    models::{ModelWithEnum, Status},
    XmlClient,
};

#[tokio::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_enum_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithEnum = resp.into_model().unwrap();
    assert_eq!(value.status, Some(Status::Success));
}

#[tokio::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = ModelWithEnum {
        status: Some(Status::Success),
    };
    client
        .get_xml_model_with_enum_value_client()
        .put(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
