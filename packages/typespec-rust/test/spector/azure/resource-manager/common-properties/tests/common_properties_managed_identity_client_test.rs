// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::credentials::{AccessToken, TokenCredential, TokenRequestOptions};
use azure_core::date::OffsetDateTime;
use azure_core::Result;
use spector_armcommon::models::{
    ManagedIdentityTrackedResource, ManagedIdentityTrackedResourceProperties,
    ManagedServiceIdentity, ManagedServiceIdentityType, UserAssignedIdentity,
};
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
        _options: Option<TokenRequestOptions>,
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

fn get_valid_mi_resource() -> ManagedIdentityTrackedResource {
    ManagedIdentityTrackedResource {
        id: Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Azure.ResourceManager.CommonProperties/managedIdentityTrackedResources/identity".to_string()),
        identity: Some(ManagedServiceIdentity {
            principal_id: Some("00000000-0000-0000-0000-000000000000".to_string()),
            tenant_id: Some("00000000-0000-0000-0000-000000000000".to_string()),
            type_prop:
                Some(spector_armcommon::models::ManagedServiceIdentityType::SystemAssigned),
            ..Default::default()
        }),
        location: Some("eastus".to_string()),
        properties: Some(ManagedIdentityTrackedResourceProperties {
            provisioning_state: Some("Succeeded".to_string()),
        }),
        tags: Some(HashMap::from([(
            "tagKey1".to_string(),
            "tagValue1".to_string(),
        )])),
        ..Default::default()
    }
}

#[tokio::test]
async fn create_with_system_assigned() {
    let resource = ManagedIdentityTrackedResource {
        identity: Some(ManagedServiceIdentity {
            type_prop: Some(spector_armcommon::models::ManagedServiceIdentityType::SystemAssigned),
            ..Default::default()
        }),
        location: Some("eastus".to_string()),
        ..Default::default()
    };

    let client = create_client();
    let resp = client
        .get_common_properties_managed_identity_client()
        .create_with_system_assigned("test-rg", "identity", resource.try_into().unwrap(), None)
        .await
        .unwrap();

    let mi_resource: ManagedIdentityTrackedResource = resp.into_body().await.unwrap();
    let expected_resource = get_valid_mi_resource();
    assert_eq!(expected_resource.id, mi_resource.id);

    let expected_identity = expected_resource.identity.unwrap();
    let mi_identity = mi_resource.identity.unwrap();
    assert_eq!(expected_identity.principal_id, mi_identity.principal_id);
    assert_eq!(expected_identity.tenant_id, mi_identity.tenant_id);
    assert_eq!(expected_identity.type_prop, mi_identity.type_prop);

    assert_eq!(expected_resource.location, mi_resource.location,);
    assert_eq!(expected_resource.tags, mi_resource.tags,);

    let expected_properties = expected_resource.properties.unwrap();
    let mi_properties = mi_resource.properties.unwrap();
    assert_eq!(
        expected_properties.provisioning_state,
        mi_properties.provisioning_state,
    );
}

#[tokio::test]
async fn get() {
    let client = create_client();
    let resp = client
        .get_common_properties_managed_identity_client()
        .get("test-rg", "identity", None)
        .await
        .unwrap();

    let mi_resource: ManagedIdentityTrackedResource = resp.into_body().await.unwrap();
    let expected_resource = get_valid_mi_resource();
    assert_eq!(expected_resource.id, mi_resource.id);

    let expected_identity = expected_resource.identity.unwrap();
    let mi_identity = mi_resource.identity.unwrap();
    assert_eq!(expected_identity.principal_id, mi_identity.principal_id);
    assert_eq!(expected_identity.tenant_id, mi_identity.tenant_id);
    assert_eq!(expected_identity.type_prop, mi_identity.type_prop);

    assert_eq!(expected_resource.location, mi_resource.location,);
    assert_eq!(expected_resource.tags, mi_resource.tags,);

    let expected_properties = expected_resource.properties.unwrap();
    let mi_properties = mi_resource.properties.unwrap();
    assert_eq!(
        expected_properties.provisioning_state,
        mi_properties.provisioning_state,
    );
}

#[tokio::test]
async fn update_with_user_assigned_and_system_assigned() {
    let resource = ManagedIdentityTrackedResource {
        identity: Some(ManagedServiceIdentity {
            type_prop: Some(ManagedServiceIdentityType::SystemAssignedUserAssigned),
             user_assigned_identities: Some(HashMap::from([
            ("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/id1".to_string(), UserAssignedIdentity::default()),
        ])),
        ..Default::default()
            }),
            location: Some("eastus".to_string()),
            ..Default::default()
    };

    let client = create_client();
    let resp = client
        .get_common_properties_managed_identity_client()
        .update_with_user_assigned_and_system_assigned(
            "test-rg",
            "identity",
            resource.try_into().unwrap(),
            None,
        )
        .await
        .unwrap();

    let mi_resource: ManagedIdentityTrackedResource = resp.into_body().await.unwrap();
    let expected_resource = get_valid_mi_resource();
    assert_eq!(expected_resource.id, mi_resource.id);

    let expected_identity = expected_resource.identity.unwrap();
    let mi_identity = mi_resource.identity.unwrap();
    assert_eq!(expected_identity.principal_id, mi_identity.principal_id);
    assert_eq!(expected_identity.tenant_id, mi_identity.tenant_id);
    assert_eq!(
        Some(ManagedServiceIdentityType::SystemAssignedUserAssigned),
        mi_identity.type_prop
    );

    assert_eq!(expected_resource.location, mi_resource.location,);
    assert_eq!(expected_resource.tags, mi_resource.tags,);

    let expected_properties = expected_resource.properties.unwrap();
    let mi_properties = mi_resource.properties.unwrap();
    assert_eq!(
        expected_properties.provisioning_state,
        mi_properties.provisioning_state,
    );
}
