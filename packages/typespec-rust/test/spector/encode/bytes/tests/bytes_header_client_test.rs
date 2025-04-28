// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_bytes::BytesClient;

#[tokio::test]
async fn base64() {
    let client = BytesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_bytes_header_client()
        .base64("test".as_bytes(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn base64_url() {
    let client = BytesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_bytes_header_client()
        .base64_url("test".as_bytes(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn base64_url_array() {
    let client = BytesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_bytes_header_client()
        .base64_url_array(&["test".as_bytes(), "test".as_bytes()], None)
        .await
        .unwrap();
}

#[tokio::test]
async fn default() {
    let client = BytesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_bytes_header_client()
        .default("test".as_bytes(), None)
        .await
        .unwrap();
}
