// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::credentials::{AccessToken, TokenCredential};
use azure_core::date::OffsetDateTime;
use azure_core::Result;
use cadl_armcommon::models::{
    ManagedIdentityTrackedResource, ManagedIdentityTrackedResourceProperties,
    ManagedServiceIdentity, ManagedServiceIdentityType, UserAssignedIdentity,
};
use cadl_armcommon::CommonPropertiesClient;
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
    async fn get_token(&self, _scopes: &[&str]) -> Result<AccessToken> {
        Ok(AccessToken::new(
            self.token.clone(),
            OffsetDateTime::now_utc(),
        ))
    }

    async fn clear_cache(&self) -> Result<()> {
        Ok(())
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
    let mut mi_identity = ManagedServiceIdentity::default();
    mi_identity.principal_id = Some("00000000-0000-0000-0000-000000000000".to_string());
    mi_identity.tenant_id = Some("00000000-0000-0000-0000-000000000000".to_string());
    mi_identity.type_prop =
        Some(cadl_armcommon::models::ManagedServiceIdentityType::SystemAssigned);

    let mut mi_properties = ManagedIdentityTrackedResourceProperties::default();
    mi_properties.provisioning_state = Some("Succeeded".to_string());

    let mut mi_resource = ManagedIdentityTrackedResource::default();
    mi_resource.id = Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Azure.ResourceManager.CommonProperties/managedIdentityTrackedResources/identity".to_string());
    mi_resource.identity = Some(mi_identity);
    mi_resource.location = Some("eastus".to_string());
    mi_resource.properties = Some(mi_properties);
    mi_resource.tags = Some(HashMap::from([(
        "tagKey1".to_string(),
        "tagValue1".to_string(),
    )]));

    mi_resource
}

#[async_std::test]
async fn create_with_system_assigned() {
    let client = create_client();
    let mut identity = ManagedServiceIdentity::default();
    identity.type_prop = Some(cadl_armcommon::models::ManagedServiceIdentityType::SystemAssigned);
    let mut resource = ManagedIdentityTrackedResource::default();
    resource.identity = Some(identity);
    resource.location = Some("eastus".to_string());

    let resp = client
        .get_common_properties_managed_identity_client()
        .create_with_system_assigned(
            "test-rg".to_string(),
            "identity".to_string(),
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

#[async_std::test]
async fn get() {
    let client = create_client();
    let resp = client
        .get_common_properties_managed_identity_client()
        .get("test-rg".to_string(), "identity".to_string(), None)
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

#[async_std::test]
async fn update_with_user_assigned_and_system_assigned() {
    let client = create_client();
    let mut identity = ManagedServiceIdentity::default();
    identity.type_prop = Some(ManagedServiceIdentityType::SystemAssignedUserAssigned);
    identity.user_assigned_identities = Some(HashMap::from([
        ("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/id1".to_string(), UserAssignedIdentity::default()),
    ]));
    let mut resource = ManagedIdentityTrackedResource::default();
    resource.identity = Some(identity);
    resource.location = Some("eastus".to_string());

    let resp = client
        .get_common_properties_managed_identity_client()
        .update_with_user_assigned_and_system_assigned(
            "test-rg".to_string(),
            "identity".to_string(),
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
