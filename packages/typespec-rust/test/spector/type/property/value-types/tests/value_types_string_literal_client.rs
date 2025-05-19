// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_valuetypes::{models::StringLiteralProperty, ValueTypesClient};

#[tokio::test]
async fn get() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_value_types_string_literal_client()
        .get(None)
        .await
        .unwrap()
        .into_body()
        .await
        .unwrap();
    assert_eq!(resp.property, Some("hello".to_string()));
}

#[tokio::test]
async fn put() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_value_types_string_literal_client()
        .put(StringLiteralProperty::default().try_into().unwrap(), None)
        .await
        .unwrap();
}
