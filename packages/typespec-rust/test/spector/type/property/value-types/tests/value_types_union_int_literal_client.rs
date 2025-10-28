// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_valuetypes::{
    models::{UnionIntLiteralProperty, UnionIntLiteralPropertyProperty},
    ValueTypesClient,
};

#[tokio::test]
async fn get() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_value_types_union_int_literal_client()
        .get(None)
        .await
        .unwrap()
        .into_body()
        .unwrap();
    assert_eq!(
        resp.property,
        Some(UnionIntLiteralPropertyProperty::INVLD_IDENTIFIER_42)
    );
}

#[tokio::test]
async fn put() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_value_types_union_int_literal_client()
        .put(
            UnionIntLiteralProperty {
                property: Some(UnionIntLiteralPropertyProperty::INVLD_IDENTIFIER_42),
            }
            .try_into()
            .unwrap(),
            None,
        )
        .await
        .unwrap();
}
