// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::{error::ErrorKind, http::StatusCode};
use spector_xml::XmlClient;

#[tokio::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let err = client
        .get_xml_xml_error_value_client()
        .get(None)
        .await
        .err()
        .unwrap();
    match err.kind() {
        ErrorKind::HttpResponse {
            status,
            error_code,
            raw_response,
        } => {
            assert_eq!(status, &StatusCode::BadRequest);
            assert_eq!(error_code, &Some("400".to_string()));
            let _ = raw_response;
        }
        _ => panic!(),
    }
}
