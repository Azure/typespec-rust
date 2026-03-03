// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_visibility::models::{ReadOnlyModel, VisibilityModel};
use spector_visibility::VisibilityClient;
use std::collections::HashMap;

fn create_client() -> VisibilityClient {
    VisibilityClient::with_no_credential("http://localhost:3000", None).unwrap()
}

#[tokio::test]
async fn delete_model() {
    let client = create_client();
    let model = VisibilityModel {
        delete_prop: Some(true),
        ..Default::default()
    };
    client
        .delete_model(model.try_into().unwrap(), None)
        .await
        .unwrap();
}

// TODO: queryProp should be sent as a query parameter (?queryProp=123),
// but the generated client serializes it in the JSON body instead.
// Remove #[should_panic] once the emitter extracts @query fields from @bodyRoot models.
// https://github.com/Azure/typespec-rust/issues/885
#[tokio::test]
#[should_panic]
async fn get_model() {
    let client = create_client();
    let model = VisibilityModel {
        query_prop: Some(123),
        ..Default::default()
    };
    let resp = client
        .get_model(model.try_into().unwrap(), None)
        .await
        .unwrap();
    let value: VisibilityModel = resp.into_model().unwrap();
    assert_eq!(value.read_prop, Some("abc".to_string()));
}

// TODO: queryProp should be sent as a query parameter (?queryProp=123),
// but the generated client serializes it in the JSON body instead.
// Remove #[should_panic] once the emitter extracts @query fields from @bodyRoot models.
// https://github.com/Azure/typespec-rust/issues/885
#[tokio::test]
#[should_panic]
async fn head_model() {
    let client = create_client();
    let model = VisibilityModel {
        query_prop: Some(123),
        ..Default::default()
    };
    client
        .head_model(model.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn patch_model() {
    let client = create_client();
    let model = VisibilityModel {
        update_prop: Some(vec![1, 2]),
        ..Default::default()
    };
    client
        .patch_model(model.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn post_model() {
    let client = create_client();
    let model = VisibilityModel {
        create_prop: Some(vec!["foo".to_string(), "bar".to_string()]),
        ..Default::default()
    };
    client
        .post_model(model.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_model() {
    let client = create_client();
    let model = VisibilityModel {
        create_prop: Some(vec!["foo".to_string(), "bar".to_string()]),
        update_prop: Some(vec![1, 2]),
        ..Default::default()
    };
    client
        .put_model(model.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_read_only_model() {
    let client = create_client();
    let model = ReadOnlyModel::default();
    let resp = client
        .put_read_only_model(model.try_into().unwrap(), None)
        .await
        .unwrap();
    let value: ReadOnlyModel = resp.into_model().unwrap();
    assert_eq!(value.optional_nullable_int_list, Some(vec![1, 2, 3]));
    assert_eq!(
        value.optional_string_record,
        Some(HashMap::from([
            ("k1".to_string(), "value1".to_string()),
            ("k2".to_string(), "value2".to_string()),
        ]))
    );
}
