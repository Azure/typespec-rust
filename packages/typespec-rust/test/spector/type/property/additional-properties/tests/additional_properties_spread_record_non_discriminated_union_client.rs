// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::time::OffsetDateTime;
use spector_addlprops::{
    models::{
        SpreadRecordForNonDiscriminatedUnion,
        SpreadRecordForNonDiscriminatedUnionAdditionalProperty, WidgetData0, WidgetData1,
    },
    AdditionalPropertiesClient,
};
use std::collections::HashMap;
use time::format_description::well_known::Rfc3339;

fn body() -> SpreadRecordForNonDiscriminatedUnion {
    let mut additional = HashMap::new();
    additional.insert(
        "prop1".to_string(),
        SpreadRecordForNonDiscriminatedUnionAdditionalProperty::WidgetData0(WidgetData0 {
            foo_prop: Some("abc".to_string()),
            kind: Some("kind0".to_string()),
        }),
    );
    additional.insert(
        "prop2".to_string(),
        SpreadRecordForNonDiscriminatedUnionAdditionalProperty::WidgetData1(WidgetData1 {
            kind: Some("kind1".to_string()),
            start: Some(OffsetDateTime::parse("2021-01-01T00:00:00Z", &Rfc3339).unwrap()),
            end: Some(OffsetDateTime::parse("2021-01-02T00:00:00Z", &Rfc3339).unwrap()),
        }),
    );
    SpreadRecordForNonDiscriminatedUnion {
        name: Some("abc".to_string()),
        additional_properties: Some(additional),
    }
}

#[tokio::test]
async fn get() {
    let client =
        AdditionalPropertiesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_additional_properties_spread_record_non_discriminated_union_client()
        .get(None)
        .await
        .unwrap()
        .into_model()
        .unwrap();
    assert_eq!(resp.name.as_deref(), Some("abc"));
    let additional = resp.additional_properties.unwrap();
    assert!(additional.contains_key("prop1"));
    assert!(additional.contains_key("prop2"));
}

#[tokio::test]
async fn put() {
    let client =
        AdditionalPropertiesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_additional_properties_spread_record_non_discriminated_union_client()
        .put(body().try_into().unwrap(), None)
        .await
        .unwrap();
}
