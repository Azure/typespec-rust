// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

mod common;

use spector_armoptemplates::models::{
    Configuration, ConfigurationProperties,
    OperationTemplatesLegacyClientCreateOrReplaceOptionalBodyOptions,
};

#[tokio::test]
async fn routed_get() {
    let client = common::create_client();

    let resp = client
        .get_operation_templates_legacy_client()
        .routed_get("test-rg", "default", "memory", None)
        .await
        .unwrap()
        .into_model()
        .unwrap();

    assert_eq!(resp.name, Some("memory".to_string()));
    assert_eq!(resp.status, Some("healthy".to_string()));
}

#[tokio::test]
async fn create_or_replace_optional_body_no_body() {
    let client = common::create_client();

    let resp = client
        .get_operation_templates_legacy_client()
        .create_or_replace_optional_body("test-rg", "default", None)
        .await
        .unwrap()
        .into_model()
        .unwrap();

    assert_eq!(resp.id, Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Azure.ResourceManager.OperationTemplates/configurations/default".to_string()));
    assert_eq!(resp.name, Some("default".to_string()));
    assert_eq!(resp.location, Some("eastus".to_string()));
    let properties = resp.properties.unwrap();
    assert_eq!(properties.config_value, Some("default-value".to_string()));
    assert_eq!(properties.provisioning_state, Some("Succeeded".to_string()));
}

#[tokio::test]
async fn create_or_replace_optional_body_with_body() {
    let client = common::create_client();

    let resp = client
        .get_operation_templates_legacy_client()
        .create_or_replace_optional_body(
            "test-rg",
            "default",
            Some(OperationTemplatesLegacyClientCreateOrReplaceOptionalBodyOptions {
                resource: Some(
                    Configuration {
                        location: Some("eastus".to_string()),
                        properties: Some(ConfigurationProperties {
                            config_value: Some("custom-value".to_string()),
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
        .into_model()
        .unwrap();

    assert_eq!(resp.id, Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Azure.ResourceManager.OperationTemplates/configurations/default".to_string()));
    assert_eq!(resp.name, Some("default".to_string()));
    assert_eq!(resp.location, Some("eastus".to_string()));
    let properties = resp.properties.unwrap();
    assert_eq!(properties.config_value, Some("custom-value".to_string()));
    assert_eq!(properties.provisioning_state, Some("Succeeded".to_string()));
}
