// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_addlprops::{models::SpreadStringRecord, AdditionalPropertiesClient};
use std::collections::HashMap;

fn body() -> SpreadStringRecord {
    let mut additional = HashMap::new();
    additional.insert("prop".to_string(), "abc".to_string());
    SpreadStringRecord {
        name: Some("SpreadSpringRecord".to_string()),
        additional_properties: Some(additional),
    }
}

#[tokio::test]
async fn get() {
    let client =
        AdditionalPropertiesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_additional_properties_spread_string_client()
        .get(None)
        .await
        .unwrap()
        .into_model()
        .unwrap();
    assert_eq!(resp.name.as_deref(), Some("SpreadSpringRecord"));
    let additional = resp.additional_properties.unwrap();
    assert_eq!(additional.get("prop").map(String::as_str), Some("abc"));
}

#[tokio::test]
async fn put() {
    let client =
        AdditionalPropertiesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_additional_properties_spread_string_client()
        .put(body().try_into().unwrap(), None)
        .await
        .unwrap();
}
