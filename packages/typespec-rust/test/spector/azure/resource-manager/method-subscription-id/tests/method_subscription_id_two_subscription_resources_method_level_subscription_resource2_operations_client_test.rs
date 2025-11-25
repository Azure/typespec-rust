// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

mod common;

use spector_armmethodsub::models::{
    ResourceProvisioningState, SubscriptionResource2, SubscriptionResource2Properties,
};

const SUBSCRIPTION_ID: &str = "00000000-0000-0000-0000-000000000000";
const SUBSCRIPTION_RESOURCE2_NAME: &str = "sub-resource-2";

#[tokio::test]
async fn subscription_resource2_get() {
    let client = common::create_client();
    let resp = client
        .get_method_subscription_id_two_subscription_resources_method_level_client()
        .get_method_subscription_id_two_subscription_resources_method_level_subscription_resource2_operations_client()
        .get(SUBSCRIPTION_ID, SUBSCRIPTION_RESOURCE2_NAME, None)
        .await
        .unwrap();

    let resource: SubscriptionResource2 = resp.into_model().unwrap();
    let expected_resource = get_valid_subscription_resource2();

    assert_eq!(expected_resource.id, resource.id);
    assert_eq!(expected_resource.name, resource.name);
    assert_eq!(expected_resource.type_prop, resource.type_prop);

    let expected_props = expected_resource.properties.unwrap();
    let resource_props = resource.properties.unwrap();

    assert_eq!(
        expected_props.provisioning_state,
        resource_props.provisioning_state
    );
    assert_eq!(expected_props.config_value, resource_props.config_value);
}

#[tokio::test]
async fn subscription_resource2_put() {
    let client = common::create_client();
    let resource = get_subscription_resource2_for_creation();
    let request_content = resource.clone().try_into().unwrap();

    let resp = client
        .get_method_subscription_id_two_subscription_resources_method_level_client()
        .get_method_subscription_id_two_subscription_resources_method_level_subscription_resource2_operations_client()
        .put(SUBSCRIPTION_ID, SUBSCRIPTION_RESOURCE2_NAME, request_content, None)
        .await
        .unwrap();

    let created_resource: SubscriptionResource2 = resp.into_model().unwrap();

    let expected_props = resource.properties.unwrap();
    let created_props = created_resource.properties.unwrap();

    assert_eq!(expected_props.config_value, created_props.config_value);
}

#[tokio::test]
async fn subscription_resource2_delete() {
    let client = common::create_client();

    client
        .get_method_subscription_id_two_subscription_resources_method_level_client()
        .get_method_subscription_id_two_subscription_resources_method_level_subscription_resource2_operations_client()
        .delete(SUBSCRIPTION_ID, SUBSCRIPTION_RESOURCE2_NAME, None)
        .await
        .unwrap();
}

fn get_valid_subscription_resource2() -> SubscriptionResource2 {
    SubscriptionResource2 {
        id: Some(format!("/subscriptions/{SUBSCRIPTION_ID}/providers/Azure.ResourceManager.MethodSubscriptionId/subscriptionResource2s/{SUBSCRIPTION_RESOURCE2_NAME}")),
        name: Some(SUBSCRIPTION_RESOURCE2_NAME.to_string()),
        type_prop: Some("Azure.ResourceManager.MethodSubscriptionId/subscriptionResource2s".to_string()),
        properties: Some(SubscriptionResource2Properties {
            provisioning_state: Some(ResourceProvisioningState::Succeeded),
            config_value: Some("test-config".to_string()),
        }),
        system_data: None,
    }
}

fn get_subscription_resource2_for_creation() -> SubscriptionResource2 {
    SubscriptionResource2 {
        id: None,
        name: None,
        type_prop: None,
        properties: Some(SubscriptionResource2Properties {
            provisioning_state: None,
            config_value: Some("test-config".to_string()),
        }),
        system_data: None,
    }
}
