// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use serde_json::json;
use spector_valuetypes::{models::UnknownDictProperty, ValueTypesClient};

#[tokio::test]
async fn get() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_value_types_unknown_dict_client()
        .get(None)
        .await
        .unwrap()
        .into_body()
        .await
        .unwrap();
    assert!(resp.property.is_some());
    if let Some(val) = resp.property {
        let obj = val.as_object().unwrap();
        assert_eq!(obj["k1"], json!("hello"));
        assert_eq!(obj["k2"], json!(42));
    }
}

#[tokio::test]
async fn put() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let dict_value = json!({
        "k1": "hello",
        "k2": 42
    });

    client
        .get_value_types_unknown_dict_client()
        .put(
            UnknownDictProperty {
                property: Some(dict_value),
            }
            .try_into()
            .unwrap(),
            None,
        )
        .await
        .unwrap();
}
