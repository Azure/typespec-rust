// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_valuetypes::{
    models::{EnumProperty, FixedInnerEnum},
    ValueTypesClient,
};

#[tokio::test]
async fn get() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_value_types_enum_client()
        .get(None)
        .await
        .unwrap()
        .into_body()
        .unwrap();
    assert_eq!(resp.property, Some(FixedInnerEnum::ValueOne));
}

#[tokio::test]
async fn put() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_value_types_enum_client()
        .put(
            EnumProperty {
                property: Some(FixedInnerEnum::ValueOne),
            }
            .try_into()
            .unwrap(),
            None,
        )
        .await
        .unwrap();
}
