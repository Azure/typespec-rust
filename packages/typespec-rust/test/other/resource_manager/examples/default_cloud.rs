// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use azure_identity::DeveloperToolsCredential;
use azure_resourcemanager_test::ResourceManagerClient;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let credential = DeveloperToolsCredential::new(None)?;
    let _client =
        ResourceManagerClient::new(std::env::var("AZURE_SUBSCRIPTION_ID")?, credential, None)?;
    Ok(())
}
