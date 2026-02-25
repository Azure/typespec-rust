// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::credentials::{AccessToken, TokenCredential, TokenRequestOptions};
use azure_core::time::OffsetDateTime;
use azure_core::Result;
use spector_arm_multi_service_shared_models::models::{
    ResourceProvisioningState, SharedMetadata, StorageAccount, StorageAccountProperties,
    VirtualMachine, VirtualMachineProperties,
};
use spector_arm_multi_service_shared_models::CombinedClient;
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

fn create_client(api_version: &str) -> CombinedClient {
    CombinedClient::new(
        "http://localhost:3000",
        Arc::new(FakeTokenCredential::new("fake_token".to_string())),
        api_version.to_string(),
        "00000000-0000-0000-0000-000000000000".to_string(),
        None,
    )
    .unwrap()
}

#[tokio::test]
async fn virtual_machine_get() {
    let client = create_client("2025-05-01");
    let resp = client
        .get_combined_virtual_machines_client()
        .get("test-rg", "vm-shared1", None)
        .await
        .unwrap();

    let vm: VirtualMachine = resp.into_model().unwrap();
    assert_eq!(
        Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.Compute/virtualMachinesShared/vm-shared1".to_string()),
        vm.id
    );
    assert_eq!(Some("vm-shared1".to_string()), vm.name);
    assert_eq!(
        Some("Microsoft.Compute/virtualMachinesShared".to_string()),
        vm.type_prop
    );
    assert_eq!(Some("eastus".to_string()), vm.location);

    let properties = vm.properties.unwrap();
    assert_eq!(
        Some(ResourceProvisioningState::Succeeded),
        properties.provisioning_state
    );
}

#[tokio::test]
async fn virtual_machine_create_or_update() {
    let resource = VirtualMachine {
        location: Some("eastus".to_string()),
        properties: Some(VirtualMachineProperties {
            metadata: Some(SharedMetadata {
                created_by: Some("user@example.com".to_string()),
                tags: Some(HashMap::from([(
                    "environment".to_string(),
                    "production".to_string(),
                )])),
                ..Default::default()
            }),
            ..Default::default()
        }),
        ..Default::default()
    };

    let client = create_client("2025-05-01");
    let poller = client
        .get_combined_virtual_machines_client()
        .create_or_update("test-rg", "vm-shared1", resource.try_into().unwrap(), None)
        .unwrap();

    let resp = poller.await.unwrap();

    let vm: VirtualMachine = resp.into_model().unwrap();
    assert_eq!(
        Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.Compute/virtualMachinesShared/vm-shared1".to_string()),
        vm.id
    );
    assert_eq!(Some("vm-shared1".to_string()), vm.name);
    assert_eq!(
        Some("Microsoft.Compute/virtualMachinesShared".to_string()),
        vm.type_prop
    );
    assert_eq!(Some("eastus".to_string()), vm.location);

    let properties = vm.properties.unwrap();
    assert_eq!(
        Some(ResourceProvisioningState::Succeeded),
        properties.provisioning_state
    );
}

#[tokio::test]
async fn storage_account_get() {
    let client = create_client("2025-02-01");
    let resp = client
        .get_combined_storage_accounts_client()
        .get("test-rg", "account1", None)
        .await
        .unwrap();

    let storage_account: StorageAccount = resp.into_model().unwrap();
    assert_eq!(
        Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.Storage/storageAccounts/account1".to_string()),
        storage_account.id
    );
    assert_eq!(Some("account1".to_string()), storage_account.name);
    assert_eq!(
        Some("Microsoft.Storage/storageAccounts".to_string()),
        storage_account.type_prop
    );
    assert_eq!(Some("westus".to_string()), storage_account.location);

    let properties = storage_account.properties.unwrap();
    assert_eq!(
        Some(ResourceProvisioningState::Succeeded),
        properties.provisioning_state
    );
}

#[tokio::test]
async fn storage_account_create_or_update() {
    let resource = StorageAccount {
        location: Some("westus".to_string()),
        properties: Some(StorageAccountProperties {
            metadata: Some(SharedMetadata {
                created_by: Some("admin@example.com".to_string()),
                tags: Some(HashMap::from([(
                    "department".to_string(),
                    "engineering".to_string(),
                )])),
                ..Default::default()
            }),
            ..Default::default()
        }),
        ..Default::default()
    };

    let client = create_client("2025-02-01");
    let poller = client
        .get_combined_storage_accounts_client()
        .create_or_update("test-rg", "account1", resource.try_into().unwrap(), None)
        .unwrap();

    let resp = poller.await.unwrap();

    let storage_account: StorageAccount = resp.into_model().unwrap();
    assert_eq!(
        Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.Storage/storageAccounts/account1".to_string()),
        storage_account.id
    );
    assert_eq!(Some("account1".to_string()), storage_account.name);
    assert_eq!(
        Some("Microsoft.Storage/storageAccounts".to_string()),
        storage_account.type_prop
    );
    assert_eq!(Some("westus".to_string()), storage_account.location);

    let properties = storage_account.properties.unwrap();
    assert_eq!(
        Some(ResourceProvisioningState::Succeeded),
        properties.provisioning_state
    );
}
