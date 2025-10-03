// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

mod common;

use azure_core::time::OffsetDateTime;
use spector_armoptemplates::models::{
    ActionRequest, ChangeAllowanceRequest, CreatedByType,
    OperationTemplatesOptionalBodyClientPatchOptions,
    OperationTemplatesOptionalBodyClientPostOptions,
    OperationTemplatesOptionalBodyClientProviderPostOptions, Widget, WidgetProperties,
};
use time::{Date, Month, Time};

#[tokio::test]
async fn get() {
    let client = common::create_client();
    let resp = client
        .get_operation_templates_optional_body_client()
        .get("test-rg", "widget1", None)
        .await
        .unwrap()
        .into_body()
        .unwrap();
    assert_eq!(resp.id, Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Azure.ResourceManager.OperationTemplates/widgets/widget1".to_string()));
    assert_eq!(resp.location, Some("eastus".to_string()));
    assert_eq!(resp.name, Some("widget1".to_string()));
    let properties = resp.properties.unwrap();
    assert_eq!(properties.description, Some("A test widget".to_string()));
    assert_eq!(properties.name, Some("widget1".to_string()));
    assert_eq!(properties.provisioning_state, Some("Succeeded".to_string()));
    let system_data = resp.system_data.unwrap();
    assert_eq!(
        system_data.created_at,
        Some(OffsetDateTime::new_utc(
            Date::from_calendar_date(2024, Month::October, 4).unwrap(),
            Time::from_hms_milli(0, 56, 7, 442).unwrap()
        ))
    );
    assert_eq!(system_data.created_by, Some("AzureSDK".to_string()));
    assert_eq!(system_data.created_by_type, Some(CreatedByType::User));
    assert_eq!(
        system_data.last_modified_at,
        Some(OffsetDateTime::new_utc(
            Date::from_calendar_date(2024, Month::October, 4).unwrap(),
            Time::from_hms_milli(0, 56, 7, 442).unwrap()
        ))
    );
    assert_eq!(system_data.last_modified_by, Some("AzureSDK".to_string()));
    assert_eq!(system_data.created_by_type, Some(CreatedByType::User));
    assert!(resp.tags.is_none());
    assert_eq!(
        resp.type_prop,
        Some("Azure.ResourceManager.OperationTemplates/widgets".to_string())
    );
}

#[tokio::test]
async fn patch_with_body() {
    let client = common::create_client();
    let resp = client
        .get_operation_templates_optional_body_client()
        .patch(
            "test-rg",
            "widget1",
            Some(OperationTemplatesOptionalBodyClientPatchOptions {
                properties: Some(
                    Widget {
                        properties: Some(WidgetProperties {
                            description: Some("Updated description".to_string()),
                            name: Some("updated-widget".to_string()),
                            ..Default::default()
                        }),
                        ..Default::default()
                    }
                    .try_into()
                    .unwrap(),
                ),
                ..Default::default()
            }),
        )
        .await
        .unwrap()
        .into_body()
        .unwrap();
    assert_eq!(resp.id, Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Azure.ResourceManager.OperationTemplates/widgets/widget1".to_string()));
    assert_eq!(resp.location, Some("eastus".to_string()));
    assert_eq!(resp.name, Some("widget1".to_string()));
    let properties = resp.properties.unwrap();
    assert_eq!(
        properties.description,
        Some("Updated description".to_string())
    );
    assert_eq!(properties.name, Some("updated-widget".to_string()));
    assert_eq!(properties.provisioning_state, Some("Succeeded".to_string()));
    let system_data = resp.system_data.unwrap();
    assert_eq!(
        system_data.created_at,
        Some(OffsetDateTime::new_utc(
            Date::from_calendar_date(2024, Month::October, 4).unwrap(),
            Time::from_hms_milli(0, 56, 7, 442).unwrap()
        ))
    );
    assert_eq!(system_data.created_by, Some("AzureSDK".to_string()));
    assert_eq!(system_data.created_by_type, Some(CreatedByType::User));
    assert_eq!(
        system_data.last_modified_at,
        Some(OffsetDateTime::new_utc(
            Date::from_calendar_date(2024, Month::October, 4).unwrap(),
            Time::from_hms_milli(0, 56, 7, 442).unwrap()
        ))
    );
    assert_eq!(system_data.last_modified_by, Some("AzureSDK".to_string()));
    assert_eq!(system_data.created_by_type, Some(CreatedByType::User));
    assert!(resp.tags.is_none());
    assert_eq!(
        resp.type_prop,
        Some("Azure.ResourceManager.OperationTemplates/widgets".to_string())
    );
}

#[tokio::test]
async fn patch_no_body() {
    let client = common::create_client();
    let resp = client
        .get_operation_templates_optional_body_client()
        .patch("test-rg", "widget1", None)
        .await
        .unwrap()
        .into_body()
        .unwrap();
    assert_eq!(resp.id, Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Azure.ResourceManager.OperationTemplates/widgets/widget1".to_string()));
    assert_eq!(resp.location, Some("eastus".to_string()));
    assert_eq!(resp.name, Some("widget1".to_string()));
    let properties = resp.properties.unwrap();
    assert_eq!(properties.description, Some("A test widget".to_string()));
    assert_eq!(properties.name, Some("widget1".to_string()));
    assert_eq!(properties.provisioning_state, Some("Succeeded".to_string()));
    let system_data = resp.system_data.unwrap();
    assert_eq!(
        system_data.created_at,
        Some(OffsetDateTime::new_utc(
            Date::from_calendar_date(2024, Month::October, 4).unwrap(),
            Time::from_hms_milli(0, 56, 7, 442).unwrap()
        ))
    );
    assert_eq!(system_data.created_by, Some("AzureSDK".to_string()));
    assert_eq!(system_data.created_by_type, Some(CreatedByType::User));
    assert_eq!(
        system_data.last_modified_at,
        Some(OffsetDateTime::new_utc(
            Date::from_calendar_date(2024, Month::October, 4).unwrap(),
            Time::from_hms_milli(0, 56, 7, 442).unwrap()
        ))
    );
    assert_eq!(system_data.last_modified_by, Some("AzureSDK".to_string()));
    assert_eq!(system_data.created_by_type, Some(CreatedByType::User));
    assert!(resp.tags.is_none());
    assert_eq!(
        resp.type_prop,
        Some("Azure.ResourceManager.OperationTemplates/widgets".to_string())
    );
}

#[tokio::test]
async fn post_with_body() {
    let client = common::create_client();
    let resp = client
        .get_operation_templates_optional_body_client()
        .post(
            "test-rg",
            "widget1",
            Some(OperationTemplatesOptionalBodyClientPostOptions {
                body: Some(
                    ActionRequest {
                        action_type: Some("perform".to_string()),
                        parameters: Some("test-parameters".to_string()),
                    }
                    .try_into()
                    .unwrap(),
                ),
                ..Default::default()
            }),
        )
        .await
        .unwrap()
        .into_body()
        .unwrap();
    assert_eq!(
        resp.result,
        Some("Action completed successfully with parameters".to_string())
    );
}

#[tokio::test]
async fn post_no_body() {
    let client = common::create_client();
    let resp = client
        .get_operation_templates_optional_body_client()
        .post("test-rg", "widget1", None)
        .await
        .unwrap()
        .into_body()
        .unwrap();
    assert_eq!(
        resp.result,
        Some("Action completed successfully".to_string())
    );
}

#[tokio::test]
async fn provider_post_with_body() {
    let client = common::create_client();
    let resp = client
        .get_operation_templates_optional_body_client()
        .provider_post(Some(
            OperationTemplatesOptionalBodyClientProviderPostOptions {
                body: Some(
                    ChangeAllowanceRequest {
                        reason: Some("Increased demand".to_string()),
                        total_allowed: Some(100),
                    }
                    .try_into()
                    .unwrap(),
                ),
                ..Default::default()
            },
        ))
        .await
        .unwrap()
        .into_body()
        .unwrap();
    assert_eq!(
        resp.status,
        Some("Changed to requested allowance".to_string())
    );
}

#[tokio::test]
async fn provider_post_no_body() {
    let client = common::create_client();
    let resp = client
        .get_operation_templates_optional_body_client()
        .provider_post(Some(
            OperationTemplatesOptionalBodyClientProviderPostOptions {
                ..Default::default()
            },
        ))
        .await
        .unwrap()
        .into_body()
        .unwrap();
    assert_eq!(
        resp.status,
        Some("Changed to default allowance".to_string())
    );
}
