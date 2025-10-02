// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_optionality::{models::RequiredAndOptionalProperty, OptionalClient};

#[tokio::test]
async fn get_all() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_optional_required_and_optional_client()
        .get_all(None)
        .await
        .unwrap()
        .into_body()
        .unwrap();
    // According to mockapi.ts, the all endpoint returns
    // { optionalProperty: "hello", requiredProperty: 42 }

    assert_eq!(resp.optional_property, Some("hello".to_string()));
    assert_eq!(resp.required_property, Some(42));
}

#[tokio::test]
async fn get_required_only() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_optional_required_and_optional_client()
        .get_required_only(None)
        .await
        .unwrap()
        .into_body()
        .unwrap();
    // According to mockapi.ts, the required-only endpoint returns { requiredProperty: 42 }
    assert_eq!(resp.optional_property, None);
    assert_eq!(resp.required_property, Some(42));
}

#[tokio::test]
async fn put_all() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    // Create a model with all properties set
    let model = RequiredAndOptionalProperty {
        optional_property: Some("hello".to_string()),
        required_property: Some(42),
    };

    client
        .get_optional_required_and_optional_client()
        .put_all(model.try_into().unwrap(), None)
        .await
        .unwrap();
    // The mockapi expects { optionalProperty: "hello", requiredProperty: 42 }
}

#[tokio::test]
async fn put_required_only() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    // Create a model with only required property set
    let model = RequiredAndOptionalProperty {
        optional_property: None,
        required_property: Some(42),
    };

    client
        .get_optional_required_and_optional_client()
        .put_required_only(model.try_into().unwrap(), None)
        .await
        .unwrap();
    // The mockapi expects { requiredProperty: 42 }
}
