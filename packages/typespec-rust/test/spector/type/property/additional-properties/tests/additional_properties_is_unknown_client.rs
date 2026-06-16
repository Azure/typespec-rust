// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use serde_json::Value;
use spector_addlprops::{models::IsUnknownAdditionalProperties, AdditionalPropertiesClient};
use std::collections::HashMap;

fn body() -> IsUnknownAdditionalProperties {
    let mut additional = HashMap::new();
    additional.insert("prop1".to_string(), Value::Number(32.into()));
    additional.insert("prop2".to_string(), Value::Bool(true));
    additional.insert("prop3".to_string(), Value::String("abc".to_string()));
    IsUnknownAdditionalProperties {
        name: Some("IsUnknownAdditionalProperties".to_string()),
        additional_properties: Some(additional),
    }
}

#[tokio::test]
async fn get() {
    let client =
        AdditionalPropertiesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_additional_properties_is_unknown_client()
        .get(None)
        .await
        .unwrap()
        .into_model()
        .unwrap();
    assert_eq!(resp.name.as_deref(), Some("IsUnknownAdditionalProperties"));
    let additional = resp.additional_properties.unwrap();
    assert_eq!(additional.get("prop1"), Some(&Value::Number(32.into())));
    assert_eq!(additional.get("prop2"), Some(&Value::Bool(true)));
    assert_eq!(
        additional.get("prop3"),
        Some(&Value::String("abc".to_string()))
    );
}

#[tokio::test]
async fn put() {
    let client =
        AdditionalPropertiesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_additional_properties_is_unknown_client()
        .put(body().try_into().unwrap(), None)
        .await
        .unwrap();
}
