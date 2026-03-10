// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_query::QueryClient;

#[tokio::test]
async fn client_endpoint_is_stored() {
    let client = QueryClient::with_no_credential("http://localhost:3000", None).unwrap();
    assert_eq!(client.endpoint().as_str(), "http://localhost:3000/");
}

#[tokio::test]
async fn client_rejects_malformed_url() {
    let result = QueryClient::with_no_credential("not-a-valid-url", None);
    assert!(result.is_err(), "malformed URL should be rejected");
}

#[tokio::test]
async fn client_rejects_non_http_scheme() {
    let result = QueryClient::with_no_credential("ftp://localhost:3000", None);
    assert!(result.is_err(), "non-http scheme should be rejected");
}

#[tokio::test]
async fn post_returns_204() {
    let client = QueryClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client.get_query_constant_client().post(None).await.unwrap();
    assert_eq!(
        resp.status(),
        204,
        "post with constant query param should return 204 No Content"
    );
}
