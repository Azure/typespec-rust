// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use serde_json::json;
use spector_valuetypes::{models::UnknownArrayProperty, ValueTypesClient};

#[tokio::test]
async fn get() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_value_types_unknown_array_client()
        .get(None)
        .await
        .unwrap()
        .into_body()
        .unwrap();
    assert!(resp.property.is_some());
    if let Some(val) = resp.property {
        let array = val.as_array().unwrap();
        assert_eq!(array.len(), 2);
        assert_eq!(array[0], json!("hello"));
        assert_eq!(array[1], json!("world"));
    }
}

#[tokio::test]
async fn put() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let array_value = json!(["hello", "world"]);

    client
        .get_value_types_unknown_array_client()
        .put(
            UnknownArrayProperty {
                property: Some(array_value),
            }
            .try_into()
            .unwrap(),
            None,
        )
        .await
        .unwrap();
}
