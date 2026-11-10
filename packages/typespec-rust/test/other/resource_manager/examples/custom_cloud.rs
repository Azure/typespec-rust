// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use azure_core::{
    cloud::{resource_manager::Audience, Audiences, CustomConfiguration},
    http::ClientOptions,
};
use azure_identity::{ClientSecretCredential, ClientSecretCredentialOptions};
use azure_resourcemanager_test::{ResourceManagerClient, ResourceManagerClientOptions};
use std::{env, sync::Arc};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut custom = CustomConfiguration::default();
    custom.authority_host = env::var("AZURE_AUTHORITY_HOST")?;
    custom.endpoint = Some(env::var("RESOURCE_MANAGER_ENDPOINT")?);
    custom.audiences = Audiences::new().with::<Audience>(env::var("RESOURCE_MANAGER_AUDIENCE")?);
    let cloud = Arc::new(custom.into());
    let credential = ClientSecretCredential::new(
        &env::var("AZURE_TENANT_ID")?,
        env::var("AZURE_CLIENT_ID")?,
        env::var("AZURE_CLIENT_SECRET")?.into(),
        Some(ClientSecretCredentialOptions {
            client_options: ClientOptions {
                cloud: Some(Arc::clone(&cloud)),
                ..Default::default()
            },
        }),
    )?;
    let _client = ResourceManagerClient::new(
        env::var("AZURE_SUBSCRIPTION_ID")?,
        credential,
        Some(ResourceManagerClientOptions {
            client_options: ClientOptions {
                cloud: Some(cloud),
                ..Default::default()
            },
            ..Default::default()
        }),
    )?;
    Ok(())
}
