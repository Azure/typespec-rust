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
    ExtensionsResource, ExtensionsResourceProperties, ProvisioningState,
    ResourcesExtensionsResourcesClientCreateOrUpdateOptions,
};
use time::{Date, Month, Time};

const TENANT: &str = "/";
const SUBSCRIPTION: &str = "/subscriptions/00000000-0000-0000-0000-000000000000";
const RESOURCE_GROUP: &str =
    "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg";
const RESOURCE: &str = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Azure.ResourceManager.Resources/topLevelTrackedResources/top";

#[tokio::test]
async fn delete_by_tenant() {
    let client = common::create_client();
    let resp = client
        .get_resources_extensions_resources_client()
        .delete(TENANT, "extension", None)
        .await
        .unwrap();

    // For delete operation, just verify it completes without error
    assert!(resp.status().is_success());
}

#[tokio::test]
async fn delete_by_subscription() {
    let client = common::create_client();
    let resp = client
        .get_resources_extensions_resources_client()
        .delete(SUBSCRIPTION, "extension", None)
        .await
        .unwrap();

    // For delete operation, just verify it completes without error
    assert!(resp.status().is_success());
}

#[tokio::test]
async fn delete_by_resource_group() {
    let client = common::create_client();
    let resp = client
        .get_resources_extensions_resources_client()
        .delete(RESOURCE_GROUP, "extension", None)
        .await
        .unwrap();

    // For delete operation, just verify it completes without error
    assert!(resp.status().is_success());
}

#[tokio::test]
async fn delete_by_resource() {
    let client = common::create_client();
    let resp = client
        .get_resources_extensions_resources_client()
        .delete(RESOURCE, "extension", None)
        .await
        .unwrap();

    // For delete operation, just verify it completes without error
    assert!(resp.status().is_success());
}

#[tokio::test]
async fn get_by_tenant() {
    let client = common::create_client();
    let resp = client
        .get_resources_extensions_resources_client()
        .get(TENANT, "extension", None)
        .await
        .unwrap();

    let resource: ExtensionsResource = resp.into_model().unwrap();
    let expected_resource = get_extension_resource("");

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

    // Validate timestamps
    validate_timestamps(
        expected_system_data.created_at,
        expected_system_data.last_modified_at,
    );
}

#[tokio::test]
async fn get_by_subscription() {
    let client = common::create_client();
    let resp = client
        .get_resources_extensions_resources_client()
        .get(SUBSCRIPTION, "extension", None)
        .await
        .unwrap();

    let resource: ExtensionsResource = resp.into_model().unwrap();
    let expected_resource = get_extension_resource(SUBSCRIPTION);

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

    // Validate timestamps
    validate_timestamps(
        expected_system_data.created_at,
        expected_system_data.last_modified_at,
    );
}

#[tokio::test]
async fn get_by_resource_group() {
    let client = common::create_client();
    let resp = client
        .get_resources_extensions_resources_client()
        .get(RESOURCE_GROUP, "extension", None)
        .await
        .unwrap();

    let resource: ExtensionsResource = resp.into_model().unwrap();
    let expected_resource = get_extension_resource(RESOURCE_GROUP);

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

    // Validate timestamps
    validate_timestamps(
        expected_system_data.created_at,
        expected_system_data.last_modified_at,
    );
}

#[tokio::test]
async fn get_by_resource() {
    let client = common::create_client();
    let resp = client
        .get_resources_extensions_resources_client()
        .get(RESOURCE, "extension", None)
        .await
        .unwrap();

    let resource: ExtensionsResource = resp.into_model().unwrap();
    let expected_resource = get_extension_resource(RESOURCE);

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

    // Validate timestamps
    validate_timestamps(
        expected_system_data.created_at,
        expected_system_data.last_modified_at,
    );
}

#[tokio::test]
async fn list_by_scope_tenant() {
    let client = common::create_client();
    let mut iter = client
        .get_resources_extensions_resources_client()
        .list_by_scope(TENANT, None)
        .unwrap();
    let mut item_count = 0;
    while let Some(item) = iter.next().await {
        item_count += 1;
        let item = item.unwrap();
        match item_count {
            1 => {
                let expected_resource = get_extension_resource("");

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

                // Validate timestamps
                validate_timestamps(
                    expected_system_data.created_at,
                    expected_system_data.last_modified_at,
                );
            }
            _ => panic!("unexpected item number"),
        }
    }
}

#[tokio::test]
async fn list_by_scope_tenant_pages() {
    let client = common::create_client();
    let mut pager = client
        .get_resources_extensions_resources_client()
        .list_by_scope(TENANT, None)
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
                let expected_resource = get_extension_resource("");

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

                // Validate timestamps
                validate_timestamps(
                    expected_system_data.created_at,
                    expected_system_data.last_modified_at,
                );
            }
            _ => panic!("unexpected page number"),
        }
    }
}

#[tokio::test]
async fn list_by_scope_subscription() {
    let client = common::create_client();
    let mut iter = client
        .get_resources_extensions_resources_client()
        .list_by_scope(SUBSCRIPTION, None)
        .unwrap();
    let mut item_count = 0;
    while let Some(item) = iter.next().await {
        item_count += 1;
        let item = item.unwrap();
        match item_count {
            1 => {
                let expected_resource = get_extension_resource(SUBSCRIPTION);

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

                // Validate timestamps
                validate_timestamps(
                    expected_system_data.created_at,
                    expected_system_data.last_modified_at,
                );
            }
            _ => panic!("unexpected item number"),
        }
    }
}

#[tokio::test]
async fn list_by_scope_subscription_pages() {
    let client = common::create_client();
    let mut pager = client
        .get_resources_extensions_resources_client()
        .list_by_scope(SUBSCRIPTION, None)
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
                let expected_resource = get_extension_resource(SUBSCRIPTION);

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

                // Validate timestamps
                validate_timestamps(
                    expected_system_data.created_at,
                    expected_system_data.last_modified_at,
                );
            }
            _ => panic!("unexpected page number"),
        }
    }
}

#[tokio::test]
async fn list_by_scope_resource_group() {
    let client = common::create_client();
    let mut iter = client
        .get_resources_extensions_resources_client()
        .list_by_scope(RESOURCE_GROUP, None)
        .unwrap();
    let mut item_count = 0;
    while let Some(item) = iter.next().await {
        item_count += 1;
        let item = item.unwrap();
        match item_count {
            1 => {
                let expected_resource = get_extension_resource(RESOURCE_GROUP);

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

                // Validate timestamps
                validate_timestamps(
                    expected_system_data.created_at,
                    expected_system_data.last_modified_at,
                );
            }
            _ => panic!("unexpected item number"),
        }
    }
}

#[tokio::test]
async fn list_by_scope_resource_group_pages() {
    let client = common::create_client();
    let mut pager = client
        .get_resources_extensions_resources_client()
        .list_by_scope(RESOURCE_GROUP, None)
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
                let expected_resource = get_extension_resource(RESOURCE_GROUP);

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

                // Validate timestamps
                validate_timestamps(
                    expected_system_data.created_at,
                    expected_system_data.last_modified_at,
                );
            }
            _ => panic!("unexpected page number"),
        }
    }
}

#[tokio::test]
async fn list_by_scope_resource() {
    let client = common::create_client();
    let mut iter = client
        .get_resources_extensions_resources_client()
        .list_by_scope(RESOURCE, None)
        .unwrap();
    let mut item_count = 0;
    while let Some(item) = iter.next().await {
        item_count += 1;
        let item = item.unwrap();
        match item_count {
            1 => {
                let expected_resource = get_extension_resource(RESOURCE);

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

                // Validate timestamps
                validate_timestamps(
                    expected_system_data.created_at,
                    expected_system_data.last_modified_at,
                );
            }
            _ => panic!("unexpected item number"),
        }
    }
}

#[tokio::test]
async fn list_by_scope_resource_pages() {
    let client = common::create_client();
    let mut pager = client
        .get_resources_extensions_resources_client()
        .list_by_scope(RESOURCE, None)
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
                let expected_resource = get_extension_resource(RESOURCE);

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

                // Validate timestamps
                validate_timestamps(
                    expected_system_data.created_at,
                    expected_system_data.last_modified_at,
                );
            }
            _ => panic!("unexpected page number"),
        }
    }
}

#[tokio::test]
async fn update_by_tenant() {
    let resource = ExtensionsResource {
        properties: Some(ExtensionsResourceProperties {
            description: Some("valid2".to_string()),
            ..Default::default()
        }),
        ..Default::default()
    };

    let client = common::create_client();
    let resp = client
        .get_resources_extensions_resources_client()
        .update(TENANT, "extension", resource.try_into().unwrap(), None)
        .await
        .unwrap();

    let created_resource: ExtensionsResource = resp.into_model().unwrap();
    let expected_resource = get_extension_resource("");

    assert_eq!(expected_resource.id, created_resource.id);
    assert_eq!(expected_resource.name, created_resource.name);
    assert_eq!(expected_resource.type_prop, created_resource.type_prop);

    let expected_props = expected_resource.properties.unwrap();
    let created_props = created_resource.properties.unwrap();
    assert_eq!(
        expected_props.provisioning_state,
        created_props.provisioning_state
    );
    assert_eq!(Some("valid2".to_string()), created_props.description);
}

#[tokio::test]
async fn update_by_subscription() {
    let resource = ExtensionsResource {
        properties: Some(ExtensionsResourceProperties {
            description: Some("valid2".to_string()),
            ..Default::default()
        }),
        ..Default::default()
    };

    let client = common::create_client();
    let resp = client
        .get_resources_extensions_resources_client()
        .update(
            SUBSCRIPTION,
            "extension",
            resource.try_into().unwrap(),
            None,
        )
        .await
        .unwrap();

    let created_resource: ExtensionsResource = resp.into_model().unwrap();
    let expected_resource = get_extension_resource(SUBSCRIPTION);

    assert_eq!(expected_resource.id, created_resource.id);
    assert_eq!(expected_resource.name, created_resource.name);
    assert_eq!(expected_resource.type_prop, created_resource.type_prop);

    let expected_props = expected_resource.properties.unwrap();
    let created_props = created_resource.properties.unwrap();
    assert_eq!(
        expected_props.provisioning_state,
        created_props.provisioning_state
    );
    assert_eq!(Some("valid2".to_string()), created_props.description);
}

#[tokio::test]
async fn update_by_resource_group() {
    let resource = ExtensionsResource {
        properties: Some(ExtensionsResourceProperties {
            description: Some("valid2".to_string()),
            ..Default::default()
        }),
        ..Default::default()
    };

    let client = common::create_client();
    let resp = client
        .get_resources_extensions_resources_client()
        .update(
            RESOURCE_GROUP,
            "extension",
            resource.try_into().unwrap(),
            None,
        )
        .await
        .unwrap();

    let created_resource: ExtensionsResource = resp.into_model().unwrap();
    let expected_resource = get_extension_resource(RESOURCE_GROUP);

    assert_eq!(expected_resource.id, created_resource.id);
    assert_eq!(expected_resource.name, created_resource.name);
    assert_eq!(expected_resource.type_prop, created_resource.type_prop);

    let expected_props = expected_resource.properties.unwrap();
    let created_props = created_resource.properties.unwrap();
    assert_eq!(
        expected_props.provisioning_state,
        created_props.provisioning_state
    );
    assert_eq!(Some("valid2".to_string()), created_props.description);
}

#[tokio::test]
async fn update_by_resource() {
    let resource = ExtensionsResource {
        properties: Some(ExtensionsResourceProperties {
            description: Some("valid2".to_string()),
            ..Default::default()
        }),
        ..Default::default()
    };

    let client = common::create_client();
    let resp = client
        .get_resources_extensions_resources_client()
        .update(RESOURCE, "extension", resource.try_into().unwrap(), None)
        .await
        .unwrap();

    let created_resource: ExtensionsResource = resp.into_model().unwrap();
    let expected_resource = get_extension_resource(RESOURCE);

    assert_eq!(expected_resource.id, created_resource.id);
    assert_eq!(expected_resource.name, created_resource.name);
    assert_eq!(expected_resource.type_prop, created_resource.type_prop);

    let expected_props = expected_resource.properties.unwrap();
    let created_props = created_resource.properties.unwrap();
    assert_eq!(
        expected_props.provisioning_state,
        created_props.provisioning_state
    );
    assert_eq!(Some("valid2".to_string()), created_props.description);
}

#[tokio::test]
async fn create_or_update() {
    let client = common::create_client().get_resources_extensions_resources_client();

    let create_or_update_request: RequestContent<ExtensionsResource> = ExtensionsResource {
        properties: Some(ExtensionsResourceProperties {
            description: Some("valid".to_string()),
            ..Default::default()
        }),
        ..Default::default()
    }
    .try_into()
    .unwrap();

    let options = Some(ResourcesExtensionsResourcesClientCreateOrUpdateOptions {
        method_options: PollerOptions {
            frequency: Duration::seconds(1),
            ..Default::default()
        },
    });

    for id in [RESOURCE_GROUP, SUBSCRIPTION, "", RESOURCE] {
        let mut poller = client
            .create_or_update(
                id.trim_start_matches('/'),
                "extension",
                create_or_update_request.clone(),
                options.clone(),
            )
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
            .create_or_update(
                id.trim_start_matches('/'),
                "extension",
                create_or_update_request.clone(),
                options.clone(),
            )
            .unwrap();

        let resource = poller.await.unwrap().into_model().unwrap();
        let expected = get_extension_resource(id);

        assert_eq!(resource.id, expected.id);
        assert_eq!(resource.name, expected.name);
        assert_eq!(resource.type_prop, expected.type_prop);

        assert!(resource.properties.is_some());
        assert_eq!(
            resource.properties.as_ref().unwrap().provisioning_state,
            expected.properties.as_ref().unwrap().provisioning_state
        );
        assert_eq!(
            resource.properties.as_ref().unwrap().description,
            expected.properties.as_ref().unwrap().description
        );

        assert!(resource.system_data.is_some());
        assert_eq!(
            resource.system_data.as_ref().unwrap().created_by,
            expected.system_data.as_ref().unwrap().created_by
        );
        assert_eq!(
            resource.system_data.as_ref().unwrap().created_by_type,
            expected.system_data.as_ref().unwrap().created_by_type
        );
        assert_eq!(
            resource.system_data.as_ref().unwrap().last_modified_by,
            expected.system_data.as_ref().unwrap().last_modified_by
        );

        assert_eq!(
            resource.system_data.as_ref().unwrap().last_modified_by_type,
            expected.system_data.as_ref().unwrap().last_modified_by_type
        );

        assert_eq!(
            resource.system_data.as_ref().unwrap().created_at,
            expected.system_data.as_ref().unwrap().created_at
        );
        assert_eq!(
            resource.system_data.as_ref().unwrap().last_modified_at,
            expected.system_data.as_ref().unwrap().last_modified_at
        );
    }
}

fn get_extension_resource(id: &str) -> ExtensionsResource {
    let mut full_id =
        "{id}/providers/Azure.ResourceManager.Resources/extensionsResources/extension".to_string();
    full_id = full_id.replace("{id}", id);
    ExtensionsResource {
        id: Some(full_id),
        name: Some("extension".to_string()),
        type_prop: Some("Azure.ResourceManager.Resources/extensionsResources".to_string()),
        properties: Some(ExtensionsResourceProperties {
            description: Some("valid".to_string()),
            provisioning_state: Some(ProvisioningState::Succeeded),
        }),
        // Using from_json to create the system_data since it's marked as #[non_exhaustive]
        system_data: serde_json::from_value(serde_json::json!({
            "createdBy": "AzureSDK",
            "createdByType": "User",
            "createdAt": "2024-10-04T00:56:07.442Z",
            "lastModifiedBy": "AzureSDK",
            "lastModifiedAt": "2024-10-04T00:56:07.442Z",
            "lastModifiedByType": "User"
        }))
        .ok(),
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
