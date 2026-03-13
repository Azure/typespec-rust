// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

// TODO: Delimited array serialization tests are blocked on codegen fix.
// See https://github.com/Azure/typespec-rust/issues/896
// The emitter generates incorrect serialization for array query parameters
// with delimiter formats (comma, pipe, space, newline). Once fixed, add
// end-to-end tests using the generated API directly.

use spector_encarray::ArrayClient;

#[tokio::test]
async fn client_construction_succeeds() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None);
    assert!(client.is_ok(), "client construction should succeed");
}

#[tokio::test]
async fn client_rejects_malformed_url() {
    let result = ArrayClient::with_no_credential("not-a-valid-url", None);
    assert!(result.is_err(), "malformed URL should be rejected");
}

#[tokio::test]
async fn client_rejects_non_http_scheme() {
    let result = ArrayClient::with_no_credential("ftp://localhost:3000", None);
    assert!(result.is_err(), "non-http scheme should be rejected");
}

#[tokio::test]
async fn subclient_is_accessible() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _property_client = client.get_array_property_client();
}
