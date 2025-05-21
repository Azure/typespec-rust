// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_optionality::{models::BooleanLiteralProperty, OptionalClient};

#[tokio::test]
async fn get_all() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_optional_boolean_literal_client()
        .get_all(None)
        .await
        .unwrap()
        .into_body()
        .await
        .unwrap();
    // According to mockapi.ts, the all endpoint returns { property: true }
    assert_eq!(resp.property, Some(true));
}

#[tokio::test]
async fn get_default() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_optional_boolean_literal_client()
        .get_default(None)
        .await
        .unwrap()
        .into_body()
        .await
        .unwrap();
    // According to mockapi.ts, the default endpoint returns {}
    assert!(resp.property.is_none());
}

#[tokio::test]
async fn put_all() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    // Create a model with property set to true (this will be serialized)
    let model = BooleanLiteralProperty {
        property: Some(true),
    };

    client
        .get_optional_boolean_literal_client()
        .put_all(model.try_into().unwrap(), None)
        .await
        .unwrap();
    // The mockapi expects { property: true }
}

#[tokio::test]
async fn put_default() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    // Create a default model with no properties set
    let model = BooleanLiteralProperty::default();

    client
        .get_optional_boolean_literal_client()
        .put_default(model.try_into().unwrap(), None)
        .await
        .unwrap();
    // The mockapi expects {}
}
