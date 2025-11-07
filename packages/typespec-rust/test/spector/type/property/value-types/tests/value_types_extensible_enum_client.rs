// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_valuetypes::{
    models::{ExtensibleEnumProperty, InnerEnum},
    ValueTypesClient,
};

#[tokio::test]
async fn get() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_value_types_extensible_enum_client()
        .get(None)
        .await
        .unwrap()
        .into_model()
        .unwrap();
    // The mock API returns "UnknownValue" which should be parsed as a custom value
    assert!(resp.property.is_some());
    if let Some(val) = resp.property {
        assert_eq!(val, InnerEnum::UnknownValue("UnknownValue".to_string()));
    }
}

#[tokio::test]
async fn put() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let custom_enum = InnerEnum::UnknownValue("UnknownValue".to_string());
    client
        .get_value_types_extensible_enum_client()
        .put(
            ExtensibleEnumProperty {
                property: Some(custom_enum),
            }
            .try_into()
            .unwrap(),
            None,
        )
        .await
        .unwrap();
}
