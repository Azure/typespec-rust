// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_addlprops::{
    models::{DifferentSpreadModelArrayDerived, ModelForRecord},
    AdditionalPropertiesClient,
};
use std::collections::HashMap;

fn models() -> Vec<ModelForRecord> {
    vec![
        ModelForRecord {
            state: Some("ok".to_string()),
        },
        ModelForRecord {
            state: Some("ok".to_string()),
        },
    ]
}

fn body() -> DifferentSpreadModelArrayDerived {
    let mut additional = HashMap::new();
    additional.insert("prop".to_string(), models());
    DifferentSpreadModelArrayDerived {
        known_prop: Some("abc".to_string()),
        derived_prop: Some(models()),
        additional_properties: Some(additional),
    }
}

#[tokio::test]
async fn get() {
    let client =
        AdditionalPropertiesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_additional_properties_extends_different_spread_model_array_client()
        .get(None)
        .await
        .unwrap()
        .into_model()
        .unwrap();
    assert_eq!(resp.known_prop.as_deref(), Some("abc"));
    let derived = resp.derived_prop.unwrap();
    assert_eq!(derived.len(), 2);
    assert_eq!(derived[0].state.as_deref(), Some("ok"));
    let additional = resp.additional_properties.unwrap();
    let prop = additional.get("prop").unwrap();
    assert_eq!(prop.len(), 2);
}

#[tokio::test]
async fn put() {
    let client =
        AdditionalPropertiesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_additional_properties_extends_different_spread_model_array_client()
        .put(body().try_into().unwrap(), None)
        .await
        .unwrap();
}
