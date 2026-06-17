// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_addlprops::{models::SpreadFloatRecord, AdditionalPropertiesClient};
use std::collections::HashMap;

fn body() -> SpreadFloatRecord {
    let mut additional = HashMap::new();
    additional.insert("prop".to_string(), 43.125_f32);
    SpreadFloatRecord {
        id: Some(43.125),
        additional_properties: Some(additional),
    }
}

#[tokio::test]
async fn get() {
    let client =
        AdditionalPropertiesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_additional_properties_spread_float_client()
        .get(None)
        .await
        .unwrap()
        .into_model()
        .unwrap();
    assert_eq!(resp.id, Some(43.125));
    let additional = resp.additional_properties.unwrap();
    assert_eq!(additional.get("prop").copied(), Some(43.125));
}

#[tokio::test]
async fn put() {
    let client =
        AdditionalPropertiesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_additional_properties_spread_float_client()
        .put(body().try_into().unwrap(), None)
        .await
        .unwrap();
}
