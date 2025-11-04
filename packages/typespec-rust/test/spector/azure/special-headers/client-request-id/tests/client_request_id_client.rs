// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::http::headers::HeaderName;
use spector_requestidheader::XmsClientRequestIdClient;

#[tokio::test]
async fn get() {
    let client =
        XmsClientRequestIdClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client.get(None).await.unwrap();
    assert!(resp
        .headers()
        .get_str(&HeaderName::from_static("x-ms-client-request-id"))
        .is_ok());
}
