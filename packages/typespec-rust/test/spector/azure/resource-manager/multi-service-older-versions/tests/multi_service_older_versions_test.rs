// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::credentials::{AccessToken, TokenCredential, TokenRequestOptions};
use azure_core::time::OffsetDateTime;
use azure_core::Result;
use spector_arm_multi_service_older_versions::models::{
    Disk, DiskProperties, ResourceProvisioningState, VirtualMachine, VirtualMachineProperties,
};
use spector_arm_multi_service_older_versions::CombinedClient;
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
    let client = create_client("2024-11-01");
    let resp = client
        .get_combined_virtual_machines_client()
        .get("test-rg", "vm-old1", None)
        .await
        .unwrap();

    let vm: VirtualMachine = resp.into_model().unwrap();
    assert_eq!(
        Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.Compute/virtualMachinesOld/vm-old1".to_string()),
        vm.id
    );
    assert_eq!(Some("vm-old1".to_string()), vm.name);
    assert_eq!(
        Some("Microsoft.Compute/virtualMachinesOld".to_string()),
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
            size: Some("Standard_D2s_v3".to_string()),
            ..Default::default()
        }),
        ..Default::default()
    };

    let client = create_client("2024-11-01");
    let poller = client
        .get_combined_virtual_machines_client()
        .create_or_update("test-rg", "vm-old1", resource.try_into().unwrap(), None)
        .unwrap();

    let resp = poller.await.unwrap();

    let vm: VirtualMachine = resp.into_model().unwrap();
    assert_eq!(
        Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.Compute/virtualMachinesOld/vm-old1".to_string()),
        vm.id
    );
    assert_eq!(Some("vm-old1".to_string()), vm.name);
    assert_eq!(
        Some("Microsoft.Compute/virtualMachinesOld".to_string()),
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
async fn disk_get() {
    let client = create_client("2024-03-02");
    let resp = client
        .get_combined_disks_client()
        .get("test-rg", "disk-old1", None)
        .await
        .unwrap();

    let disk: Disk = resp.into_model().unwrap();
    assert_eq!(
        Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.Compute/disksOld/disk-old1".to_string()),
        disk.id
    );
    assert_eq!(Some("disk-old1".to_string()), disk.name);
    assert_eq!(
        Some("Microsoft.Compute/disksOld".to_string()),
        disk.type_prop
    );
    assert_eq!(Some("eastus".to_string()), disk.location);

    let properties = disk.properties.unwrap();
    assert_eq!(
        Some(ResourceProvisioningState::Succeeded),
        properties.provisioning_state
    );
}

#[tokio::test]
async fn disk_create_or_update() {
    let resource = Disk {
        location: Some("eastus".to_string()),
        properties: Some(DiskProperties {
            disk_size_gb: Some(128),
            ..Default::default()
        }),
        ..Default::default()
    };

    let client = create_client("2024-03-02");
    let poller = client
        .get_combined_disks_client()
        .create_or_update("test-rg", "disk-old1", resource.try_into().unwrap(), None)
        .unwrap();

    let resp = poller.await.unwrap();

    let disk: Disk = resp.into_model().unwrap();
    assert_eq!(
        Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.Compute/disksOld/disk-old1".to_string()),
        disk.id
    );
    assert_eq!(Some("disk-old1".to_string()), disk.name);
    assert_eq!(
        Some("Microsoft.Compute/disksOld".to_string()),
        disk.type_prop
    );
    assert_eq!(Some("eastus".to_string()), disk.location);

    let properties = disk.properties.unwrap();
    assert_eq!(
        Some(ResourceProvisioningState::Succeeded),
        properties.provisioning_state
    );
}
