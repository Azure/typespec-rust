// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_valuetypes::{
    models::{UnionFloatLiteralProperty, UnionFloatLiteralPropertyProperty},
    ValueTypesClient,
};

#[tokio::test]
async fn get() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_value_types_union_float_literal_client()
        .get(None)
        .await
        .unwrap()
        .into_model()
        .unwrap();
    assert_eq!(
        resp.property,
        Some(UnionFloatLiteralPropertyProperty::INVLD_IDENTIFIER_46_875)
    );
}

#[tokio::test]
async fn put() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_value_types_union_float_literal_client()
        .put(
            UnionFloatLiteralProperty {
                property: Some(UnionFloatLiteralPropertyProperty::INVLD_IDENTIFIER_46_875),
            }
            .try_into()
            .unwrap(),
            None,
        )
        .await
        .unwrap();
}
