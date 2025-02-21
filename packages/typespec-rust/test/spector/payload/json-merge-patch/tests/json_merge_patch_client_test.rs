// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_jmergepatch::{
    models::{
        InnerModel, JsonMergePatchClientUpdateOptionalResourceOptions, Resource, ResourcePatch,
    },
    JsonMergePatchClient,
};
use std::collections::HashMap;

#[tokio::test]
async fn create_resource() {
    let client = JsonMergePatchClient::with_no_credential("http://localhost:3000", None).unwrap();
    let inner_model = InnerModel {
        name: Some(String::from("InnerMadge")),
        description: Some(String::from("innerDesc")),
    };

    let resource = Resource {
        name: Some(String::from("Madge")),
        description: Some(String::from("desc")),
        map: HashMap::from([(String::from("key"), inner_model.clone())]),
        array: vec![inner_model.clone()],
        int_value: Some(1),
        float_value: Some(1.1),
        inner_model: Some(inner_model),
        int_array: vec![1, 2, 3],
    };

    let resp = client
        .create_resource(resource.try_into().unwrap(), None)
        .await
        .unwrap();

    let value: Resource = resp.into_body().await.unwrap();
    assert_eq!(value.name, Some(String::from("Madge")));
    assert_eq!(value.description, Some(String::from("desc")));

    let map_val = value.map.get("key").unwrap();
    assert_eq!(map_val.name, Some(String::from("InnerMadge")));
    assert_eq!(map_val.description, Some(String::from("innerDesc")));

    let array_val = value.array;
    assert_eq!(array_val.len(), 1);
    assert_eq!(array_val[0].name, Some(String::from("InnerMadge")));
    assert_eq!(array_val[0].description, Some(String::from("innerDesc")));

    assert_eq!(value.int_value, Some(1));
    assert_eq!(value.float_value, Some(1.1));

    let inner_model_resp = value.inner_model.unwrap();
    assert_eq!(inner_model_resp.name, Some(String::from("InnerMadge")));
    assert_eq!(
        inner_model_resp.description,
        Some(String::from("innerDesc"))
    );

    let int_array_val = value.int_array;
    assert_eq!(int_array_val, vec![1, 2, 3]);
}

#[tokio::test]
#[should_panic]
async fn update_optional_resource() {
    let client = JsonMergePatchClient::with_no_credential("http://localhost:3000", None).unwrap();

    let resource_patch = ResourcePatch::default();
    // TODO: https://github.com/Azure/azure-sdk-for-rust/issues/1649 to send JSON nulls

    let options = JsonMergePatchClientUpdateOptionalResourceOptions {
        body: Some(resource_patch.try_into().unwrap()),
        ..Default::default()
    };

    let _resp = client
        .update_optional_resource(Some(options))
        .await
        .unwrap();
}

#[tokio::test]
#[should_panic]
async fn update_resource() {
    let client = JsonMergePatchClient::with_no_credential("http://localhost:3000", None).unwrap();

    let resource_patch = ResourcePatch::default();
    // TODO: https://github.com/Azure/azure-sdk-for-rust/issues/1649 to send JSON nulls

    let _resp = client
        .update_resource(resource_patch.try_into().unwrap(), None)
        .await
        .unwrap();
}
