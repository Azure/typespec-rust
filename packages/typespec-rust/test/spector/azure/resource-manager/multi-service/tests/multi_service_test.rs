// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::cloud::Audiences;
use azure_core::cloud::{CloudConfiguration, CustomConfiguration};
use azure_core::credentials::{AccessToken, TokenCredential, TokenRequestOptions};
use azure_core::http::ClientOptions;
use azure_core::time::OffsetDateTime;
use azure_core::Result;
use spector_arm_multi_service::{
    compute::models::{VirtualMachine, VirtualMachineProperties},
    compute_disk::models::{Disk, DiskProperties},
    models::ResourceProvisioningState,
    Audience, CombinedClient, CombinedClientOptions,
};
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

fn create_client() -> CombinedClient {
    let mut custom_cloud_config = CustomConfiguration::default();
    custom_cloud_config.authority_host = "http://localhost:3000".to_string();
    custom_cloud_config.audiences =
        Audiences::new().with::<Audience>("http://localhost:3000".to_string());

    CombinedClient::new(
        "00000000-0000-0000-0000-000000000000".to_string(),
        Arc::new(FakeTokenCredential::new("fake_token".to_string())),
        Some(CombinedClientOptions {
            client_options: ClientOptions {
                cloud: Some(Arc::new(CloudConfiguration::Custom(custom_cloud_config))),
                ..Default::default()
            },
            ..Default::default()
        }),
    )
    .unwrap()
}

#[tokio::test]
async fn virtual_machine_get() {
    let client = create_client();
    let resp = client
        .get_combined_virtual_machines_client()
        .get("test-rg", "vm1", None)
        .await
        .unwrap();

    let vm: VirtualMachine = resp.into_model().unwrap();
    assert_eq!(
        Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.Compute/virtualMachines/vm1".to_string()),
        vm.id
    );
    assert_eq!(Some("vm1".to_string()), vm.name);
    assert_eq!(
        Some("Microsoft.Compute/virtualMachines".to_string()),
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
        properties: Some(VirtualMachineProperties::default()),
        ..Default::default()
    };

    let client = create_client();
    let poller = client
        .get_combined_virtual_machines_client()
        .begin_create_or_update("test-rg", "vm1", resource.try_into().unwrap(), None)
        .unwrap();

    let resp = poller.await.unwrap();

    let vm: VirtualMachine = resp.into_model().unwrap();
    assert_eq!(
        Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.Compute/virtualMachines/vm1".to_string()),
        vm.id
    );
    assert_eq!(Some("vm1".to_string()), vm.name);
    assert_eq!(
        Some("Microsoft.Compute/virtualMachines".to_string()),
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
    let client = create_client();
    let resp = client
        .get_combined_disks_client()
        .get("test-rg", "disk1", None)
        .await
        .unwrap();

    let disk: Disk = resp.into_model().unwrap();
    assert_eq!(
        Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.Compute/disks/disk1".to_string()),
        disk.id
    );
    assert_eq!(Some("disk1".to_string()), disk.name);
    assert_eq!(Some("Microsoft.Compute/disks".to_string()), disk.type_prop);
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
        properties: Some(DiskProperties::default()),
        ..Default::default()
    };

    let client = create_client();
    let poller = client
        .get_combined_disks_client()
        .begin_create_or_update("test-rg", "disk1", resource.try_into().unwrap(), None)
        .unwrap();

    let resp = poller.await.unwrap();

    let disk: Disk = resp.into_model().unwrap();
    assert_eq!(
        Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.Compute/disks/disk1".to_string()),
        disk.id
    );
    assert_eq!(Some("disk1".to_string()), disk.name);
    assert_eq!(Some("Microsoft.Compute/disks".to_string()), disk.type_prop);
    assert_eq!(Some("eastus".to_string()), disk.location);

    let properties = disk.properties.unwrap();
    assert_eq!(
        Some(ResourceProvisioningState::Succeeded),
        properties.provisioning_state
    );
}
