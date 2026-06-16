// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_naming::{header::models::NamingHeaderClientResponseResultHeaders, NamingClient};

#[tokio::test]
async fn request() {
    let client = NamingClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_naming_header_client()
        .request("true".to_string(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn response() {
    let client = NamingClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_naming_header_client()
        .response(None)
        .await
        .unwrap();
    let h = resp.client_name().unwrap();
    assert_eq!(h, Some("true".to_string()));
}
