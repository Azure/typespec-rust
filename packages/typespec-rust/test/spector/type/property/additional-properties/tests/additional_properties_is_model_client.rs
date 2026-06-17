// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_addlprops::{
    models::{IsModelAdditionalProperties, ModelForRecord},
    AdditionalPropertiesClient,
};
use std::collections::HashMap;

fn model() -> ModelForRecord {
    ModelForRecord {
        state: Some("ok".to_string()),
    }
}

fn body() -> IsModelAdditionalProperties {
    let mut additional = HashMap::new();
    additional.insert("prop".to_string(), model());
    IsModelAdditionalProperties {
        known_prop: Some(model()),
        additional_properties: Some(additional),
    }
}

#[tokio::test]
async fn get() {
    let client =
        AdditionalPropertiesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_additional_properties_is_model_client()
        .get(None)
        .await
        .unwrap()
        .into_model()
        .unwrap();
    assert_eq!(resp.known_prop.unwrap().state.as_deref(), Some("ok"));
    let additional = resp.additional_properties.unwrap();
    assert_eq!(
        additional.get("prop").and_then(|m| m.state.as_deref()),
        Some("ok")
    );
}

#[tokio::test]
async fn put() {
    let client =
        AdditionalPropertiesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_additional_properties_is_model_client()
        .put(body().try_into().unwrap(), None)
        .await
        .unwrap();
}
