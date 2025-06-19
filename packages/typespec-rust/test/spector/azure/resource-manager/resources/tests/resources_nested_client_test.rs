// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

mod common;

use azure_core::time::OffsetDateTime;
use futures::StreamExt;
use spector_armresources::models::{NestedProxyResource, NestedProxyResourceProperties};
use time::{Date, Month, Time};

#[tokio::test]
async fn get() {
    let client = common::create_client();
    let resp = client
        .get_resources_nested_client()
        .get("test-rg", "top", "nested", None)
        .await
        .unwrap();

    let resource: NestedProxyResource = resp.into_body().await.unwrap();
    let expected_resource = get_valid_nested_resource();

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

    let expected_system_data = expected_resource.system_data.unwrap();
    let resource_system_data = resource.system_data.unwrap();
    assert_eq!(
        expected_system_data.created_by,
        resource_system_data.created_by
    );
    assert_eq!(
        expected_system_data.created_by_type,
        resource_system_data.created_by_type
    );

    validate_timestamps(
        resource_system_data.created_at,
        resource_system_data.last_modified_at,
    );
}

#[tokio::test]
async fn list_by_top_level_tracked_resource() {
    let client = common::create_client();
    let mut iter = client
        .get_resources_nested_client()
        .list_by_top_level_tracked_resource("test-rg", "top", None)
        .unwrap();

    let mut item_count = 0;
    while let Some(item) = iter.next().await {
        item_count += 1;
        let item = item.unwrap();
        match item_count {
            1 => {
                let expected_resource = get_valid_nested_resource();

                assert_eq!(expected_resource.id, item.id);
                assert_eq!(expected_resource.name, item.name);
                assert_eq!(expected_resource.type_prop, item.type_prop);

                let expected_props = expected_resource.properties.unwrap();
                let resource_props = item.properties.unwrap();
                assert_eq!(
                    expected_props.provisioning_state,
                    resource_props.provisioning_state
                );
                assert_eq!(expected_props.description, resource_props.description);

                let expected_system_data = expected_resource.system_data.unwrap();
                let resource_system_data = item.system_data.unwrap();
                assert_eq!(
                    expected_system_data.created_by,
                    resource_system_data.created_by
                );
                assert_eq!(
                    expected_system_data.created_by_type,
                    resource_system_data.created_by_type
                );

                validate_timestamps(
                    resource_system_data.created_at,
                    resource_system_data.last_modified_at,
                );
            }
            _ => panic!("unexpected item number"),
        }
    }
}

#[tokio::test]
async fn list_by_top_level_tracked_resource_pages() {
    let client = common::create_client();
    let mut pager = client
        .get_resources_nested_client()
        .list_by_top_level_tracked_resource("test-rg", "top", None)
        .unwrap()
        .into_pages();

    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let resources = page.into_body().await.unwrap();
        match page_count {
            1 => {
                assert_eq!(resources.value.len(), 1);
                let resource = resources.value[0].clone();
                let expected_resource = get_valid_nested_resource();

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

                let expected_system_data = expected_resource.system_data.unwrap();
                let resource_system_data = resource.system_data.unwrap();
                assert_eq!(
                    expected_system_data.created_by,
                    resource_system_data.created_by
                );
                assert_eq!(
                    expected_system_data.created_by_type,
                    resource_system_data.created_by_type
                );

                validate_timestamps(
                    resource_system_data.created_at,
                    resource_system_data.last_modified_at,
                );
            }
            _ => panic!("unexpected page number"),
        }
    }
}

fn get_valid_nested_resource() -> NestedProxyResource {
    NestedProxyResource {
        id: Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Azure.ResourceManager.Resources/topLevelTrackedResources/top/nestedProxyResources/nested".to_string()),
        name: Some("nested".to_string()),
        type_prop: Some("Azure.ResourceManager.Resources/topLevelTrackedResources/top/nestedProxyResources".to_string()),
        properties: Some(NestedProxyResourceProperties {
            provisioning_state: Some(spector_armresources::models::ProvisioningState::Succeeded),
            description: Some("valid".to_string()),
        }),
        // Using from_json to create the system_data since it's marked as #[non_exhaustive]
        system_data: serde_json::from_value(serde_json::json!({
            "createdBy": "AzureSDK",
            "createdByType": "User",
            "createdAt": "2024-10-04T00:56:07.442Z",
            "lastModifiedBy": "AzureSDK",
            "lastModifiedAt": "2024-10-04T00:56:07.442Z",
            "lastModifiedByType": "User"
        })).ok(),
    }
}

/// Helper function to validate system data timestamps
fn validate_timestamps(
    created_at: Option<OffsetDateTime>,
    last_modified_at: Option<OffsetDateTime>,
) {
    // Create expected timestamp using OffsetDateTime::new_utc
    let expected_dt = OffsetDateTime::new_utc(
        Date::from_calendar_date(2024, Month::October, 4).unwrap(),
        Time::from_hms_milli(0, 56, 7, 442).unwrap(),
    );

    // Verify date components match expected values
    assert_eq!(created_at, Some(expected_dt));
    assert_eq!(last_modified_at, Some(expected_dt));
}
