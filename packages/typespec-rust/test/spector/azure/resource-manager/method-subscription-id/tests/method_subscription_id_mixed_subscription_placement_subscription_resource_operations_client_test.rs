// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

mod common;

use spector_armmethodsub::models::{
    ResourceProvisioningState, SubscriptionResource, SubscriptionResourceProperties,
};

const SUBSCRIPTION_ID: &str = "00000000-0000-0000-0000-000000000000";
const SUBSCRIPTION_RESOURCE_NAME: &str = "sub-resource";

#[tokio::test]
async fn subscription_resource_get() {
    let client = common::create_client();
    let resp = client
        .get_method_subscription_id_mixed_subscription_placement_client()
        .get_method_subscription_id_mixed_subscription_placement_subscription_resource_operations_client()
        .get(SUBSCRIPTION_ID, SUBSCRIPTION_RESOURCE_NAME, None)
        .await
        .unwrap();

    let resource: SubscriptionResource = resp.into_model().unwrap();
    let expected_resource = get_valid_subscription_resource();

    assert_eq!(expected_resource.id, resource.id);
    assert_eq!(expected_resource.name, resource.name);
    assert_eq!(expected_resource.type_prop, resource.type_prop);

    let expected_props = expected_resource.properties.unwrap();
    let resource_props = resource.properties.unwrap();

    assert_eq!(
        expected_props.provisioning_state,
        resource_props.provisioning_state
    );
    assert_eq!(
        expected_props.subscription_setting,
        resource_props.subscription_setting
    );
}

#[tokio::test]
async fn subscription_resource_put() {
    let client = common::create_client();
    let resource = get_subscription_resource_for_creation();
    let request_content = resource.clone().try_into().unwrap();

    let resp = client
        .get_method_subscription_id_mixed_subscription_placement_client()
        .get_method_subscription_id_mixed_subscription_placement_subscription_resource_operations_client()
        .put(SUBSCRIPTION_ID, SUBSCRIPTION_RESOURCE_NAME, request_content, None)
        .await
        .unwrap();

    let created_resource: SubscriptionResource = resp.into_model().unwrap();

    let expected_props = resource.properties.unwrap();
    let created_props = created_resource.properties.unwrap();

    assert_eq!(
        expected_props.subscription_setting,
        created_props.subscription_setting
    );
}

#[tokio::test]
async fn subscription_resource_delete() {
    let client = common::create_client();

    client
        .get_method_subscription_id_mixed_subscription_placement_client()
        .get_method_subscription_id_mixed_subscription_placement_subscription_resource_operations_client()
        .delete(SUBSCRIPTION_ID, SUBSCRIPTION_RESOURCE_NAME, None)
        .await
        .unwrap();
}

fn get_valid_subscription_resource() -> SubscriptionResource {
    SubscriptionResource {
        id: Some(format!("/subscriptions/{}/providers/Azure.ResourceManager.MethodSubscriptionId/subscriptionResources/{}", SUBSCRIPTION_ID, SUBSCRIPTION_RESOURCE_NAME)),
        name: Some(SUBSCRIPTION_RESOURCE_NAME.to_string()),
        type_prop: Some("Azure.ResourceManager.MethodSubscriptionId/subscriptionResources".to_string()),
        properties: Some(SubscriptionResourceProperties {
            provisioning_state: Some(ResourceProvisioningState::Succeeded),
            subscription_setting: Some("test-sub-setting".to_string()),
        }),
        system_data: None,
    }
}

fn get_subscription_resource_for_creation() -> SubscriptionResource {
    SubscriptionResource {
        id: None,
        name: None,
        type_prop: None,
        properties: Some(SubscriptionResourceProperties {
            provisioning_state: None,
            subscription_setting: Some("test-sub-setting".to_string()),
        }),
        system_data: None,
    }
}
