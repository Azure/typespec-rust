// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_customauth::{CustomClient, KeyCredential};

#[tokio::test]
async fn invalid() {
    let client = CustomClient::with_key_credential(
        "http://localhost:3000",
        KeyCredential::new("invalid".to_string()),
        None,
    )
    .unwrap();
    let rsp = client.invalid(None).await;
    assert!(rsp.is_err());
}

#[tokio::test]
async fn valid() {
    let client = CustomClient::with_key_credential(
        "http://localhost:3000",
        KeyCredential::new("valid-key".to_string()),
        None,
    )
    .unwrap();
    client.valid(None).await.unwrap();
}
