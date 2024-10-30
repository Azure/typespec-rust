// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use cadl_jmergepatch::{
    json_merge_patch_client,
    models::{InnerModel, Resource, ResourcePatch},
    JsonMergePatchClient,
};
use std::collections::HashMap;

#[async_std::test]
async fn create_resource() {
    let client = JsonMergePatchClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut inner_model = InnerModel::default();
    inner_model.name = Some(String::from("InnerMadge"));
    inner_model.description = Some(String::from("innerDesc"));

    let mut resource = Resource::default();
    resource.name = Some(String::from("Madge"));
    resource.description = Some(String::from("desc"));
    resource.map = Some(HashMap::from([(String::from("key"), inner_model.clone())]));
    resource.array = Some(vec![inner_model.clone()]);
    resource.int_value = Some(1);
    resource.float_value = Some(1.1);
    resource.inner_model = Some(inner_model);
    resource.int_array = Some(vec![1, 2, 3]);

    let resp = client
        .create_resource(resource.try_into().unwrap(), None)
        .await
        .unwrap();

    let value: Resource = resp.try_into().unwrap();
    assert_eq!(value.name, Some(String::from("Madge")));
    assert_eq!(value.description, Some(String::from("desc")));

    let map_val = value.map.as_ref().unwrap().get("key").unwrap();
    assert_eq!(map_val.name, Some(String::from("InnerMadge")));
    assert_eq!(map_val.description, Some(String::from("innerDesc")));

    let array_val = value.array.unwrap();
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

    let int_array_val = value.int_array.unwrap();
    assert_eq!(int_array_val, vec![1, 2, 3]);
}

#[async_std::test]
#[should_panic]
async fn update_optional_resource() {
    let client = JsonMergePatchClient::with_no_credential("http://localhost:3000", None).unwrap();

    let resource_patch = ResourcePatch::default();
    // TODO: https://github.com/Azure/azure-sdk-for-rust/issues/1649 to send JSON nulls

    let options = json_merge_patch_client::JsonMergePatchClientUpdateOptionalResourceOptions {
        body: Some(resource_patch.try_into().unwrap()),
        ..Default::default()
    };

    let _resp = client
        .update_optional_resource(Some(options))
        .await
        .unwrap();
}

#[async_std::test]
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
