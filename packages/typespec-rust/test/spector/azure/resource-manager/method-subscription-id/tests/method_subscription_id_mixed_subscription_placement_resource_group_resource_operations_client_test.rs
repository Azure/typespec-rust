// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

mod common;

use spector_armmethodsub::models::{
    ResourceGroupResource, ResourceGroupResourceProperties, ResourceProvisioningState,
};

const RESOURCE_GROUP_NAME: &str = "test-rg";
const RESOURCE_GROUP_RESOURCE_NAME: &str = "rg-resource";

#[tokio::test]
async fn resource_group_resource_get() {
    let client = common::create_client();
    let resp = client
        .get_method_subscription_id_mixed_subscription_placement_client()
        .get_method_subscription_id_mixed_subscription_placement_resource_group_resource_operations_client()
        .get(RESOURCE_GROUP_NAME, RESOURCE_GROUP_RESOURCE_NAME, None)
        .await
        .unwrap();

    let resource: ResourceGroupResource = resp.into_model().unwrap();
    let expected_resource = get_valid_resource_group_resource();

    assert_eq!(expected_resource.id, resource.id);
    assert_eq!(expected_resource.name, resource.name);
    assert_eq!(expected_resource.type_prop, resource.type_prop);
    assert_eq!(expected_resource.location, resource.location);

    let expected_props = expected_resource.properties.unwrap();
    let resource_props = resource.properties.unwrap();

    assert_eq!(
        expected_props.provisioning_state,
        resource_props.provisioning_state
    );
    assert_eq!(
        expected_props.resource_group_setting,
        resource_props.resource_group_setting
    );
}

#[tokio::test]
async fn resource_group_resource_put() {
    let client = common::create_client();
    let resource = get_resource_group_resource_for_creation();
    let request_content = resource.clone().try_into().unwrap();

    let resp = client
        .get_method_subscription_id_mixed_subscription_placement_client()
        .get_method_subscription_id_mixed_subscription_placement_resource_group_resource_operations_client()
        .put(RESOURCE_GROUP_NAME, RESOURCE_GROUP_RESOURCE_NAME, request_content, None)
        .await
        .unwrap();

    let created_resource: ResourceGroupResource = resp.into_model().unwrap();

    assert_eq!(resource.location, created_resource.location);

    let expected_props = resource.properties.unwrap();
    let created_props = created_resource.properties.unwrap();

    assert_eq!(
        expected_props.resource_group_setting,
        created_props.resource_group_setting
    );
}

#[tokio::test]
async fn resource_group_resource_delete() {
    let client = common::create_client();

    client
        .get_method_subscription_id_mixed_subscription_placement_client()
        .get_method_subscription_id_mixed_subscription_placement_resource_group_resource_operations_client()
        .delete(RESOURCE_GROUP_NAME, RESOURCE_GROUP_RESOURCE_NAME, None)
        .await
        .unwrap();
}

fn get_valid_resource_group_resource() -> ResourceGroupResource {
    ResourceGroupResource {
        id: Some(format!("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/{RESOURCE_GROUP_NAME}/providers/Azure.ResourceManager.MethodSubscriptionId/resourceGroupResources/{RESOURCE_GROUP_RESOURCE_NAME}")),
        name: Some(RESOURCE_GROUP_RESOURCE_NAME.to_string()),
        type_prop: Some("Azure.ResourceManager.MethodSubscriptionId/resourceGroupResources".to_string()),
        location: Some("eastus".to_string()),
        properties: Some(ResourceGroupResourceProperties {
            provisioning_state: Some(ResourceProvisioningState::Succeeded),
            resource_group_setting: Some("test-setting".to_string()),
        }),
        system_data: None,
        tags: None,
    }
}

fn get_resource_group_resource_for_creation() -> ResourceGroupResource {
    ResourceGroupResource {
        id: None,
        name: None,
        type_prop: None,
        location: Some("eastus".to_string()),
        properties: Some(ResourceGroupResourceProperties {
            provisioning_state: None,
            resource_group_setting: Some("test-setting".to_string()),
        }),
        system_data: None,
        tags: None,
    }
}
