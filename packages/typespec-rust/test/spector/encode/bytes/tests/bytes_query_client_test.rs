// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_bytes::BytesClient;

#[async_std::test]
async fn base64() {
    let client = BytesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_bytes_query_client()
        .base64("test".as_bytes().to_owned(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn base64_url() {
    let client = BytesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_bytes_query_client()
        .base64_url("test".as_bytes().to_owned(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn base64_url_array() {
    let client = BytesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_bytes_query_client()
        .base64_url_array(
            vec!["test".as_bytes().to_owned(), "test".as_bytes().to_owned()],
            None,
        )
        .await
        .unwrap();
}

#[async_std::test]
async fn default() {
    let client = BytesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_bytes_query_client()
        .default("test".as_bytes().to_owned(), None)
        .await
        .unwrap();
}
