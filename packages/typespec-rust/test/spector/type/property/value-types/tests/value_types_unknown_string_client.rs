// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use serde_json::json;
use spector_valuetypes::{models::UnknownStringProperty, ValueTypesClient};

#[tokio::test]
async fn get() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_value_types_unknown_string_client()
        .get(None)
        .await
        .unwrap()
        .into_model()
        .unwrap();
    assert!(resp.property.is_some());
    if let Some(val) = resp.property {
        assert_eq!(val, json!("hello"));
    }
}

#[tokio::test]
async fn put() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let string_value = json!("hello");

    client
        .get_value_types_unknown_string_client()
        .put(
            UnknownStringProperty {
                property: Some(string_value),
            }
            .try_into()
            .unwrap(),
            None,
        )
        .await
        .unwrap();
}
