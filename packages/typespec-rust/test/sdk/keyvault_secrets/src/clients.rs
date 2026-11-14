// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

//! Clients used to communicate with Key Vault.

#[cfg(all(feature = "test", feature = "unstable_fake"))]
pub use crate::generated::clients::fake;
pub use crate::generated::clients::SecretClient;

/// Options for constructing a [`SecretClient`].
#[derive(Clone, azure_core::fmt::SafeDebug)]
pub struct SecretClientOptions {
    /// The service API version.
    pub api_version: String,
    /// Allows customization of the client.
    pub client_options: azure_core::http::ClientOptions,
}

impl Default for SecretClientOptions {
    fn default() -> Self {
        Self {
            api_version: crate::generated::clients::DEFAULT_API_VERSION.into(),
            client_options: Default::default(),
        }
    }
}
