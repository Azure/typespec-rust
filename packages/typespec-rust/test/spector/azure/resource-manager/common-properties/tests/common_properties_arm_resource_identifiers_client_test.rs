// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

mod common;

use spector_armcommon::models::{
    ArmResourceIdentifierResource, ArmResourceIdentifierResourceProperties,
    ResourceProvisioningState,
};

const ARM_ID_SIMPLE: &str = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.Network/virtualNetworks/myVnet";
const ARM_ID_WITH_TYPE: &str = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.Network/virtualNetworks/myVnet";
const ARM_ID_WITH_TYPE_AND_SCOPE: &str = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.Network/virtualNetworks/myVnet";
const ARM_ID_WITH_ALL_SCOPES: &str = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.Compute/virtualMachines/myVm";

fn get_valid_arm_resource_identifier_resource() -> ArmResourceIdentifierResource {
    ArmResourceIdentifierResource {
        id: Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Azure.ResourceManager.CommonProperties/armResourceIdentifierResources/armId".to_string()),
        location: Some("eastus".to_string()),
        name: Some("armId".to_string()),
        type_prop: Some(
            "Azure.ResourceManager.CommonProperties/armResourceIdentifierResources".to_string(),
        ),
        properties: Some(ArmResourceIdentifierResourceProperties {
            provisioning_state: Some(ResourceProvisioningState::Succeeded),
            simple_arm_id: Some(ARM_ID_SIMPLE.to_string()),
            arm_id_with_type: Some(ARM_ID_WITH_TYPE.to_string()),
            arm_id_with_type_and_scope: Some(ARM_ID_WITH_TYPE_AND_SCOPE.to_string()),
            arm_id_with_all_scopes: Some(ARM_ID_WITH_ALL_SCOPES.to_string()),
        }),
        ..Default::default()
    }
}

fn assert_resource_matches_expected(actual: &ArmResourceIdentifierResource) {
    let expected = get_valid_arm_resource_identifier_resource();
    assert_eq!(expected.id, actual.id);
    assert_eq!(expected.location, actual.location);
    assert_eq!(expected.name, actual.name);
    assert_eq!(expected.type_prop, actual.type_prop);

    let expected_properties = expected.properties.unwrap();
    let actual_properties = actual
        .properties
        .as_ref()
        .expect("properties should be set");
    assert_eq!(
        expected_properties.provisioning_state,
        actual_properties.provisioning_state
    );
    assert_eq!(
        expected_properties.simple_arm_id,
        actual_properties.simple_arm_id
    );
    assert_eq!(
        expected_properties.arm_id_with_type,
        actual_properties.arm_id_with_type
    );
    assert_eq!(
        expected_properties.arm_id_with_type_and_scope,
        actual_properties.arm_id_with_type_and_scope
    );
    assert_eq!(
        expected_properties.arm_id_with_all_scopes,
        actual_properties.arm_id_with_all_scopes
    );
}

#[tokio::test]
async fn get() {
    let client = common::create_client();
    let resp = client
        .get_common_properties_arm_resource_identifiers_client()
        .get("test-rg", "armId", None)
        .await
        .unwrap();

    let resource: ArmResourceIdentifierResource = resp.into_model().unwrap();
    assert_resource_matches_expected(&resource);
}

#[tokio::test]
async fn create_or_replace() {
    let resource = ArmResourceIdentifierResource {
        location: Some("eastus".to_string()),
        properties: Some(ArmResourceIdentifierResourceProperties {
            simple_arm_id: Some(ARM_ID_SIMPLE.to_string()),
            arm_id_with_type: Some(ARM_ID_WITH_TYPE.to_string()),
            arm_id_with_type_and_scope: Some(ARM_ID_WITH_TYPE_AND_SCOPE.to_string()),
            arm_id_with_all_scopes: Some(ARM_ID_WITH_ALL_SCOPES.to_string()),
            ..Default::default()
        }),
        ..Default::default()
    };

    let client = common::create_client();
    let resp = client
        .get_common_properties_arm_resource_identifiers_client()
        .create_or_replace("test-rg", "armId", resource.try_into().unwrap(), None)
        .await
        .unwrap();

    let resource: ArmResourceIdentifierResource = resp.into_model().unwrap();
    assert_resource_matches_expected(&resource);
}
