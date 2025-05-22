// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_optionality::{
    models::{UnionFloatLiteralProperty, UnionFloatLiteralPropertyProperty},
    OptionalClient,
};

// TODO: https://github.com/Azure/typespec-rust/issues/25

#[should_panic]
#[tokio::test]
async fn get_all() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_optional_union_float_literal_client()
        .get_all(None)
        .await
        .unwrap()
        .into_body()
        .await
        .unwrap();
    // According to mockapi.ts, the all endpoint returns { property: 2.375 }
    assert_eq!(
        resp.property,
        Some(UnionFloatLiteralPropertyProperty::Float32Value2Point375)
    );
}

#[tokio::test]
async fn get_default() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_optional_union_float_literal_client()
        .get_default(None)
        .await
        .unwrap()
        .into_body()
        .await
        .unwrap(); // According to mockapi.ts, the default endpoint returns {}
    assert!(resp.property.is_none());
}

// TODO: https://github.com/Azure/typespec-rust/issues/25

#[should_panic]
#[tokio::test]
async fn put_all() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    // Create a model with property set to union float literal
    let model = UnionFloatLiteralProperty {
        property: Some(UnionFloatLiteralPropertyProperty::Float32Value2Point375),
    };

    client
        .get_optional_union_float_literal_client()
        .put_all(model.try_into().unwrap(), None)
        .await
        .unwrap();
    // The mockapi expects { property: 2.375 }
}

#[tokio::test]
async fn put_default() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    // Create a default model with no properties set
    let model = UnionFloatLiteralProperty::default();

    client
        .get_optional_union_float_literal_client()
        .put_default(model.try_into().unwrap(), None)
        .await
        .unwrap();
    // The mockapi expects {}
}
