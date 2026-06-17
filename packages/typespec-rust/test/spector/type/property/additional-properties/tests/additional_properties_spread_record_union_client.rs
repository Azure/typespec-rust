// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_addlprops::{
    models::{SpreadRecordForUnion, SpreadRecordForUnionAdditionalProperty},
    AdditionalPropertiesClient,
};
use std::collections::HashMap;

fn body() -> SpreadRecordForUnion {
    let mut additional = HashMap::new();
    additional.insert(
        "prop1".to_string(),
        SpreadRecordForUnionAdditionalProperty::String("abc".to_string()),
    );
    additional.insert(
        "prop2".to_string(),
        SpreadRecordForUnionAdditionalProperty::Float32(43.125),
    );
    SpreadRecordForUnion {
        flag: Some(true),
        additional_properties: Some(additional),
    }
}

#[tokio::test]
async fn get() {
    let client =
        AdditionalPropertiesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_additional_properties_spread_record_union_client()
        .get(None)
        .await
        .unwrap()
        .into_model()
        .unwrap();
    assert_eq!(resp.flag, Some(true));
    let additional = resp.additional_properties.unwrap();
    match additional.get("prop1") {
        Some(SpreadRecordForUnionAdditionalProperty::String(s)) => assert_eq!(s, "abc"),
        other => panic!("unexpected prop1: {other:?}"),
    }
    match additional.get("prop2") {
        Some(SpreadRecordForUnionAdditionalProperty::Float32(f)) => assert_eq!(*f, 43.125),
        other => panic!("unexpected prop2: {other:?}"),
    }
}

#[tokio::test]
async fn put() {
    let client =
        AdditionalPropertiesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_additional_properties_spread_record_union_client()
        .put(body().try_into().unwrap(), None)
        .await
        .unwrap();
}
