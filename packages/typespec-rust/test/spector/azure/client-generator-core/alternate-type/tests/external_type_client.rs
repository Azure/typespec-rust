// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::http::RequestContent;
use geojson::{Feature, Geometry, Value};
use serde_json::Map;
use spector_alternatetype::{models::ModelWithFeatureProperty, AlternateTypeClient};

fn create_feature() -> Feature {
    let geometry = Geometry::new(Value::Point(vec![-122.25, 37.87]));
    let mut properties = Map::new();
    properties.insert(
        "name".to_string(),
        serde_json::Value::String("A single point of interest".to_string()),
    );
    properties.insert(
        "category".to_string(),
        serde_json::Value::String("landmark".to_string()),
    );
    properties.insert(
        "elevation".to_string(),
        serde_json::Value::Number(100.into()),
    );

    Feature {
        bbox: None,
        geometry: Some(geometry),
        id: Some(geojson::feature::Id::String("feature-1".to_string())),
        properties: Some(properties),
        foreign_members: None,
    }
}

#[tokio::test]
async fn get_model() {
    let client = AlternateTypeClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_alternate_type_external_type_client()
        .get_model(None)
        .await
        .unwrap();
    let feature: Feature = resp.into_model().unwrap();
    assert!(feature.geometry.is_some());
    assert_eq!(
        feature.id,
        Some(geojson::feature::Id::String("feature-1".to_string()))
    );
}

#[tokio::test]
async fn put_model() {
    let client = AlternateTypeClient::with_no_credential("http://localhost:3000", None).unwrap();
    let feature = create_feature();
    let json = serde_json::to_string(&feature).unwrap();
    client
        .get_alternate_type_external_type_client()
        .put_model(RequestContent::from_str(&json), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn get_property() {
    let client = AlternateTypeClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_alternate_type_external_type_client()
        .get_property(None)
        .await
        .unwrap();
    let model: ModelWithFeatureProperty = resp.into_model().unwrap();
    assert!(model.feature.is_some());
    assert_eq!(model.additional_property, Some("extra".to_string()));
}

#[tokio::test]
async fn put_property() {
    let client = AlternateTypeClient::with_no_credential("http://localhost:3000", None).unwrap();
    let feature = create_feature();
    let model = ModelWithFeatureProperty {
        feature: Some(feature),
        additional_property: Some("extra".to_string()),
    };
    client
        .get_alternate_type_external_type_client()
        .put_property(model.try_into().unwrap(), None)
        .await
        .unwrap();
}
