// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use rust_decimal::{prelude::FromPrimitive, Decimal};
use spector_valuetypes::{models::Decimal128Property, ValueTypesClient};

#[tokio::test]
async fn get() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_value_types_decimal128_client()
        .get(None)
        .await
        .unwrap()
        .into_body()
        .await
        .unwrap();
    assert_eq!(resp.property, Some(Decimal::from_f32(0.33333).unwrap()));
}

// TODO: https://github.com/Azure/typespec-rust/issues/417

#[should_panic]
#[tokio::test]
async fn put() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_value_types_decimal128_client()
        .put(
            Decimal128Property {
                property: Some(Decimal::from_f32(0.33333).unwrap()),
            }
            .try_into()
            .unwrap(),
            None,
        )
        .await
        .unwrap();
}
