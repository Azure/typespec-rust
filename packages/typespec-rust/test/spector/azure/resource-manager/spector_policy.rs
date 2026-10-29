// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use azure_core::{
    credentials::TokenCredential,
    http::{
        headers::AUTHORIZATION,
        policies::{Policy, PolicyResult, TransportPolicy},
        Context, Request, Transport,
    },
};
use std::sync::Arc;

#[derive(Debug)]
pub struct SpectorPolicy {
    transport: TransportPolicy,
    credential: Option<Arc<dyn TokenCredential>>,
}

impl Default for SpectorPolicy {
    fn default() -> Self {
        Self {
            transport: TransportPolicy::new(Transport::default()),
            credential: None,
        }
    }
}

impl SpectorPolicy {
    #[allow(dead_code)]
    pub fn with_credential(credential: Arc<dyn TokenCredential>) -> Self {
        Self {
            credential: Some(credential),
            ..Default::default()
        }
    }
}

#[async_trait::async_trait]
impl Policy for SpectorPolicy {
    async fn send(
        &self,
        ctx: &Context,
        request: &mut Request,
        _next: &[Arc<dyn Policy>],
    ) -> PolicyResult {
        assert_eq!(request.url().scheme(), "http");
        assert_eq!(request.url().host_str(), Some("localhost"));
        assert_eq!(request.url().port(), Some(3000));
        if let Some(credential) = &self.credential {
            let token = credential
                .get_token(&["https://security.microsoft.com/.default"], None)
                .await?;
            request.insert_header(AUTHORIZATION, format!("Bearer {}", token.token.secret()));
        }
        // The real bearer policy requires HTTPS, so send localhost mock requests directly.
        self.transport.send(ctx, request, &[]).await
    }
}
