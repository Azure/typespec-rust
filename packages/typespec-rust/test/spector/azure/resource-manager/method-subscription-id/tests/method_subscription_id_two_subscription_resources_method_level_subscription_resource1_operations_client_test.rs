// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

mod common;

use spector_armmethodsub::models::{
    ResourceProvisioningState, SubscriptionResource1, SubscriptionResource1Properties,
};

const SUBSCRIPTION_ID: &str = "00000000-0000-0000-0000-000000000000";
const SUBSCRIPTION_RESOURCE1_NAME: &str = "sub-resource-1";

#[tokio::test]
async fn subscription_resource1_get() {
    let client = common::create_client();
    let resp = client
        .get_method_subscription_id_two_subscription_resources_method_level_client()
        .get_method_subscription_id_two_subscription_resources_method_level_subscription_resource1_operations_client()
        .get(SUBSCRIPTION_ID, SUBSCRIPTION_RESOURCE1_NAME, None)
        .await
        .unwrap();

    let resource: SubscriptionResource1 = resp.into_model().unwrap();
    let expected_resource = get_valid_subscription_resource1();

    assert_eq!(expected_resource.id, resource.id);
    assert_eq!(expected_resource.name, resource.name);
    assert_eq!(expected_resource.type_prop, resource.type_prop);

    let expected_props = expected_resource.properties.unwrap();
    let resource_props = resource.properties.unwrap();

    assert_eq!(
        expected_props.provisioning_state,
        resource_props.provisioning_state
    );
    assert_eq!(expected_props.description, resource_props.description);
}

#[tokio::test]
async fn subscription_resource1_put() {
    let client = common::create_client();
    let resource = get_subscription_resource1_for_creation();
    let request_content = resource.clone().try_into().unwrap();

    let resp = client
        .get_method_subscription_id_two_subscription_resources_method_level_client()
        .get_method_subscription_id_two_subscription_resources_method_level_subscription_resource1_operations_client()
        .put(SUBSCRIPTION_ID, SUBSCRIPTION_RESOURCE1_NAME, request_content, None)
        .await
        .unwrap();

    let created_resource: SubscriptionResource1 = resp.into_model().unwrap();

    let expected_props = resource.properties.unwrap();
    let created_props = created_resource.properties.unwrap();

    assert_eq!(expected_props.description, created_props.description);
}

#[tokio::test]
async fn subscription_resource1_delete() {
    let client = common::create_client();

    client
        .get_method_subscription_id_two_subscription_resources_method_level_client()
        .get_method_subscription_id_two_subscription_resources_method_level_subscription_resource1_operations_client()
        .delete(SUBSCRIPTION_ID, SUBSCRIPTION_RESOURCE1_NAME, None)
        .await
        .unwrap();
}

fn get_valid_subscription_resource1() -> SubscriptionResource1 {
    SubscriptionResource1 {
        id: Some(format!("/subscriptions/{}/providers/Azure.ResourceManager.MethodSubscriptionId/subscriptionResource1s/{}", SUBSCRIPTION_ID, SUBSCRIPTION_RESOURCE1_NAME)),
        name: Some(SUBSCRIPTION_RESOURCE1_NAME.to_string()),
        type_prop: Some("Azure.ResourceManager.MethodSubscriptionId/subscriptionResource1s".to_string()),
        properties: Some(SubscriptionResource1Properties {
            provisioning_state: Some(ResourceProvisioningState::Succeeded),
            description: Some("Valid subscription resource 1".to_string()),
        }),
        system_data: None,
    }
}

fn get_subscription_resource1_for_creation() -> SubscriptionResource1 {
    SubscriptionResource1 {
        id: None,
        name: None,
        type_prop: None,
        properties: Some(SubscriptionResource1Properties {
            provisioning_state: None,
            description: Some("Valid subscription resource 1".to_string()),
        }),
        system_data: None,
    }
}
