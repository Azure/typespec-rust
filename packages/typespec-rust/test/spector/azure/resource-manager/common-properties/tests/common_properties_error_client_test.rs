// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::credentials::{AccessToken, TokenCredential, TokenRequestOptions};
use azure_core::time::OffsetDateTime;
use azure_core::Result;
use spector_armcommon::models::{ConfidentialResource, ConfidentialResourceProperties};
use spector_armcommon::CommonPropertiesClient;
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug)]
struct FakeTokenCredential {
    pub token: String,
}

impl FakeTokenCredential {
    pub fn new(token: String) -> Self {
        FakeTokenCredential { token }
    }
}

#[async_trait::async_trait]
impl TokenCredential for FakeTokenCredential {
    async fn get_token(
        &self,
        _scopes: &[&str],
        _options: Option<TokenRequestOptions<'_>>,
    ) -> Result<AccessToken> {
        Ok(AccessToken::new(
            self.token.clone(),
            OffsetDateTime::now_utc(),
        ))
    }
}

fn create_client() -> CommonPropertiesClient {
    CommonPropertiesClient::new(
        "http://localhost:3000",
        Arc::new(FakeTokenCredential::new("fake_token".to_string())),
        "00000000-0000-0000-0000-000000000000".to_string(),
        None,
    )
    .unwrap()
}

fn get_valid_confidential_resource() -> ConfidentialResource {
    ConfidentialResource {
        id: Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Azure.ResourceManager.CommonProperties/confidentialResources/resource".to_string()),
        location: Some("eastus".to_string()),
        name: Some("resource".to_string()),
        properties: Some(ConfidentialResourceProperties {
            provisioning_state: Some("Succeeded".to_string()),
            username: Some("testuser".to_string()),
        }),
        tags: Some(HashMap::from([(
            "tagKey1".to_string(),
            "tagValue1".to_string(),
        )])),
        type_prop: Some("Azure.ResourceManager.CommonProperties/confidentialResources".to_string()),
        ..Default::default()
    }
}

#[tokio::test]
async fn create_for_user_defined_error() {
    let resource = ConfidentialResource {
        location: Some("eastus".to_string()),
        properties: Some(ConfidentialResourceProperties {
            username: Some("testuser".to_string()),
            ..Default::default()
        }),
        ..Default::default()
    };

    let client = create_client();
    let resp = client
        .get_common_properties_error_client()
        .create_for_user_defined_error("test-rg", "resource", resource.try_into().unwrap(), None)
        .await
        .unwrap();

    let confidential_resource: ConfidentialResource = resp.into_model().unwrap();
    let expected_resource = get_valid_confidential_resource();

    assert_eq!(expected_resource.id, confidential_resource.id);
    assert_eq!(expected_resource.location, confidential_resource.location);
    assert_eq!(expected_resource.name, confidential_resource.name);
    assert_eq!(expected_resource.tags, confidential_resource.tags);
    assert_eq!(expected_resource.type_prop, confidential_resource.type_prop);

    let expected_properties = expected_resource.properties.unwrap();
    let confidential_properties = confidential_resource.properties.unwrap();
    assert_eq!(
        expected_properties.provisioning_state,
        confidential_properties.provisioning_state,
    );
    assert_eq!(
        expected_properties.username,
        confidential_properties.username,
    );
}

#[tokio::test]
async fn get_for_predefined_error() {
    let client = create_client();
    let resp = client
        .get_common_properties_error_client()
        .get_for_predefined_error("test-rg", "resource", None)
        .await
        .unwrap();

    let confidential_resource: ConfidentialResource = resp.into_model().unwrap();
    let expected_resource = get_valid_confidential_resource();

    assert_eq!(expected_resource.id, confidential_resource.id);
    assert_eq!(expected_resource.location, confidential_resource.location);
    assert_eq!(expected_resource.name, confidential_resource.name);
    assert_eq!(expected_resource.tags, confidential_resource.tags);
    assert_eq!(expected_resource.type_prop, confidential_resource.type_prop);

    let expected_properties = expected_resource.properties.unwrap();
    let confidential_properties = confidential_resource.properties.unwrap();
    assert_eq!(
        expected_properties.provisioning_state,
        confidential_properties.provisioning_state,
    );
    assert_eq!(
        expected_properties.username,
        confidential_properties.username,
    );
}
