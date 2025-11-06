// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use serde_json::Number;
use spector_numeric::{
    models::{SafeintAsStringProperty, Uint32AsStringProperty, Uint8AsStringProperty},
    NumericClient,
};

#[tokio::test]
async fn test_safeint_as_string() {
    let client = NumericClient::with_no_credential("http://localhost:3000", None).unwrap();

    let property = SafeintAsStringProperty {
        value: Number::from_i128(10000000000),
    };

    // Call the API
    let response = client
        .get_numeric_property_client()
        .safeint_as_string(property.try_into().unwrap(), None)
        .await
        .unwrap()
        .into_model()
        .unwrap();

    // Verify the response
    assert!(response.value.is_some());
    let value = response.value.unwrap();
    assert_eq!(value.to_string(), "10000000000");
}

#[tokio::test]
async fn test_uint32_as_string_optional() {
    let client = NumericClient::with_no_credential("http://localhost:3000", None).unwrap();

    let property = Uint32AsStringProperty { value: Some(1) };

    // Call the API
    let response = client
        .get_numeric_property_client()
        .uint32_as_string_optional(property.try_into().unwrap(), None)
        .await
        .unwrap()
        .into_model()
        .unwrap();

    // Verify the response
    assert!(response.value.is_some());
    assert_eq!(response.value.unwrap(), 1_u32);
}

#[tokio::test]
async fn test_uint8_as_string() {
    let client = NumericClient::with_no_credential("http://localhost:3000", None).unwrap();

    // Create the input value
    // Per mockapi.ts, the server expects the value as a string: "255"
    // But our model uses u8, so we need to use a compatible value
    let property = Uint8AsStringProperty { value: Some(255) };

    // Call the API
    let response = client
        .get_numeric_property_client()
        .uint8_as_string(property.try_into().unwrap(), None)
        .await
        .unwrap()
        .into_model()
        .unwrap();

    // Verify the response
    assert!(response.value.is_some());
    assert_eq!(response.value.unwrap(), 255_u8);
}
