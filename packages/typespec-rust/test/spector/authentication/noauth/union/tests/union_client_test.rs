// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_noauth::UnionClient;

#[tokio::test]
async fn valid_no_auth() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.valid_no_auth(None).await.unwrap();
}

#[tokio::test]
async fn valid_token() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.valid_token(None).await.unwrap();
}
