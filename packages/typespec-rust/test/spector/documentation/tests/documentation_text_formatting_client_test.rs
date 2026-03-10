// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_documentation::DocumentationClient;

#[tokio::test]
async fn bold_text_returns_204() {
    let client = DocumentationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_documentation_text_formatting_client()
        .bold_text(None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 204, "bold_text should return 204 No Content");
}

#[tokio::test]
async fn client_endpoint_is_stored() {
    let client = DocumentationClient::with_no_credential("http://localhost:3000", None).unwrap();
    assert_eq!(client.endpoint().as_str(), "http://localhost:3000/");
}

#[tokio::test]
async fn client_rejects_malformed_url() {
    let result = DocumentationClient::with_no_credential("not-a-valid-url", None);
    assert!(result.is_err(), "malformed URL should be rejected");
}

#[tokio::test]
async fn client_rejects_non_http_scheme() {
    let result = DocumentationClient::with_no_credential("ftp://localhost:3000", None);
    assert!(result.is_err(), "non-http scheme should be rejected");
}

#[tokio::test]
async fn combined_formatting_returns_204() {
    let client = DocumentationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_documentation_text_formatting_client()
        .combined_formatting(None)
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        204,
        "combined_formatting should return 204 No Content"
    );
}

#[tokio::test]
async fn italic_text_returns_204() {
    let client = DocumentationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_documentation_text_formatting_client()
        .italic_text(None)
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        204,
        "italic_text should return 204 No Content"
    );
}
