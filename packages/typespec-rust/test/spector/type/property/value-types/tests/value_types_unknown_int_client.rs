// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use serde_json::json;
use spector_valuetypes::{models::UnknownIntProperty, ValueTypesClient};

#[tokio::test]
async fn get() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_value_types_unknown_int_client()
        .get(None)
        .await
        .unwrap()
        .into_body()
        .unwrap();
    assert!(resp.property.is_some());
    if let Some(val) = resp.property {
        assert_eq!(val, json!(42));
    }
}

#[tokio::test]
async fn put() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let int_value = json!(42);

    client
        .get_value_types_unknown_int_client()
        .put(
            UnknownIntProperty {
                property: Some(int_value),
            }
            .try_into()
            .unwrap(),
            None,
        )
        .await
        .unwrap();
}
