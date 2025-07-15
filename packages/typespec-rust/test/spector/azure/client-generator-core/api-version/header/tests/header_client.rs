// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_apiverheader::HeaderClient;

#[tokio::test]
async fn header_api_version() {
    let client = HeaderClient::with_no_credential("http://localhost:3000", None).unwrap();
    let res = match client.header_api_version(None).await {
        Ok(response) => response,
        Err(e) => panic!("Request failed: {}", e),
    };
    assert_eq!(res.status(), 200);
}
