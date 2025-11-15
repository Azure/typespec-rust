// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

mod common;

use azure_core::{
    http::{
        poller::{PollerOptions, PollerStatus, StatusMonitor},
        RequestContent, StatusCode,
    },
    time::{Duration, OffsetDateTime},
};
use futures::StreamExt;
use spector_armresources::models::{
    CreatedByType, ProvisioningState, ResourcesSingletonClientCreateOrUpdateOptions,
    SingletonTrackedResource, SingletonTrackedResourceProperties,
};
use time::{Date, Month, Time};

#[tokio::test]
async fn get_by_resource_group() {
    let client = common::create_client();
    let resp = client
        .get_resources_singleton_client()
        .get_by_resource_group("test-rg", None)
        .await
        .unwrap();

    let resource: SingletonTrackedResource = resp.into_model().unwrap();
    let expected_resource = get_valid_singleton_resource();

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
async fn list_by_resource_group() {
    let client = common::create_client();
    let mut iter = client
        .get_resources_singleton_client()
        .list_by_resource_group("test-rg", None)
        .unwrap();

    let mut item_count = 0;
    while let Some(item) = iter.next().await {
        item_count += 1;
        let item = item.unwrap();
        match item_count {
            1 => {
                let expected_resource = get_valid_singleton_resource();

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
async fn list_by_resource_group_pages() {
    let client = common::create_client();
    let mut pager = client
        .get_resources_singleton_client()
        .list_by_resource_group("test-rg", None)
        .unwrap()
        .into_pages();

    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let resources = page.into_model().unwrap();
        match page_count {
            1 => {
                assert_eq!(resources.value.len(), 1);
                let resource = resources.value[0].clone();
                let expected_resource = get_valid_singleton_resource();

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

#[tokio::test]
async fn update() {
    let resource = SingletonTrackedResource {
        properties: Some(SingletonTrackedResourceProperties {
            description: Some("valid2".to_string()),
            ..Default::default()
        }),
        ..Default::default()
    };

    let client = common::create_client();
    let resp = client
        .get_resources_singleton_client()
        .update("test-rg", resource.try_into().unwrap(), None)
        .await
        .unwrap();

    let created_resource: SingletonTrackedResource = resp.into_model().unwrap();
    let expected_resource = get_valid_singleton_resource();

    assert_eq!(expected_resource.id, created_resource.id);
    assert_eq!(expected_resource.name, created_resource.name);
    assert_eq!(expected_resource.type_prop, created_resource.type_prop);

    let expected_props = expected_resource.properties.unwrap();
    let resource_props = created_resource.properties.unwrap();
    assert_eq!(
        expected_props.provisioning_state,
        resource_props.provisioning_state
    );
    assert_eq!(Some("valid2".to_string()), resource_props.description);

    let expected_system_data = expected_resource.system_data.unwrap();
    let resource_system_data = created_resource.system_data.unwrap();
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

fn get_valid_singleton_resource() -> SingletonTrackedResource {
    SingletonTrackedResource {
        id: Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Azure.ResourceManager.Resources/singletonTrackedResources/default".to_string()),
        name: Some("default".to_string()),
        type_prop: Some("Azure.ResourceManager.Resources/singletonTrackedResources".to_string()),
        location: Some("eastus".to_string()),
        properties: Some(SingletonTrackedResourceProperties {
            provisioning_state: Some(ProvisioningState::Succeeded),
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
        ..Default::default()
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

#[tokio::test]
async fn create_or_update() {
    let client = common::create_client().get_resources_singleton_client();

    let create_or_update_request: RequestContent<SingletonTrackedResource> =
        SingletonTrackedResource {
            location: Some("eastus".to_string()),
            properties: Some(SingletonTrackedResourceProperties {
                description: Some("valid".to_string()),
                ..Default::default()
            }),
            ..Default::default()
        }
        .try_into()
        .unwrap();

    let options = Some(ResourcesSingletonClientCreateOrUpdateOptions {
        method_options: PollerOptions {
            frequency: Duration::seconds(1),
            ..Default::default()
        },
    });

    let mut poller = client
        .create_or_update("test-rg", create_or_update_request.clone(), options.clone())
        .unwrap();

    let mut poll_count = 0;
    while let Some(result) = poller.next().await {
        poll_count += 1;
        let response = result.unwrap();
        let http_status = response.status();
        let status_monitor = response.into_model().unwrap();
        let poller_status = status_monitor.status();
        match poll_count {
            1 => {
                assert_eq!(http_status, StatusCode::Ok);
                assert_eq!(poller_status, PollerStatus::Succeeded);
            }
            _ => {
                panic!("unexpected poll count");
            }
        }
    }
    assert_eq!(poll_count, 1);

    let poller = client
        .create_or_update("test-rg", create_or_update_request, options)
        .unwrap();
    let final_result = poller.await.unwrap().into_model().unwrap();

    assert_eq!(final_result.id, Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Azure.ResourceManager.Resources/singletonTrackedResources/default".to_string()));
    assert_eq!(final_result.name, Some("default".to_string()));
    assert_eq!(
        final_result.type_prop,
        Some("Azure.ResourceManager.Resources/singletonTrackedResources".to_string())
    );

    assert!(final_result.properties.is_some());
    assert_eq!(
        final_result.properties.as_ref().unwrap().provisioning_state,
        Some(ProvisioningState::Succeeded)
    );
    assert_eq!(
        final_result.properties.as_ref().unwrap().description,
        Some("valid".to_string())
    );

    assert!(final_result.system_data.is_some());
    assert_eq!(
        final_result.system_data.as_ref().unwrap().created_by,
        Some("AzureSDK".to_string())
    );
    assert_eq!(
        final_result.system_data.as_ref().unwrap().created_by_type,
        Some(CreatedByType::User)
    );
    assert_eq!(
        final_result.system_data.as_ref().unwrap().created_at,
        Some(OffsetDateTime::new_utc(
            Date::from_calendar_date(2024, Month::October, 4).unwrap(),
            Time::from_hms_milli(0, 56, 7, 442).unwrap(),
        ))
    );
    assert_eq!(
        final_result.system_data.as_ref().unwrap().last_modified_by,
        Some("AzureSDK".to_string())
    );
    assert_eq!(
        final_result
            .system_data
            .as_ref()
            .unwrap()
            .last_modified_by_type,
        Some(CreatedByType::User)
    );
    assert_eq!(
        final_result.system_data.as_ref().unwrap().last_modified_at,
        Some(OffsetDateTime::new_utc(
            Date::from_calendar_date(2024, Month::October, 4).unwrap(),
            Time::from_hms_milli(0, 56, 7, 442).unwrap(),
        ))
    );
}
