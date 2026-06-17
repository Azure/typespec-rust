// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_addlprops::{models::IsStringAdditionalProperties, AdditionalPropertiesClient};
use std::collections::HashMap;

fn body() -> IsStringAdditionalProperties {
    let mut additional = HashMap::new();
    additional.insert("prop".to_string(), "abc".to_string());
    IsStringAdditionalProperties {
        name: Some("IsStringAdditionalProperties".to_string()),
        additional_properties: Some(additional),
    }
}

#[tokio::test]
async fn get() {
    let client =
        AdditionalPropertiesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_additional_properties_is_string_client()
        .get(None)
        .await
        .unwrap()
        .into_model()
        .unwrap();
    assert_eq!(resp.name.as_deref(), Some("IsStringAdditionalProperties"));
    let additional = resp.additional_properties.unwrap();
    assert_eq!(additional.get("prop").map(String::as_str), Some("abc"));
}

#[tokio::test]
async fn put() {
    let client =
        AdditionalPropertiesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_additional_properties_is_string_client()
        .put(body().try_into().unwrap(), None)
        .await
        .unwrap();
}
