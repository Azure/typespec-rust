// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

mod common;

use azure_core::http::StatusCode;
use spector_armcommon::models::{ConfidentialResource, ConfidentialResourceProperties};

#[tokio::test]
async fn create_for_user_defined_error() {
    let resource = ConfidentialResource {
        location: Some("eastus".to_string()),
        properties: Some(ConfidentialResourceProperties {
            username: Some("testuser".to_string()),
            ..Default::default()
        }),
        ..Default::default()
    };

    let client = common::create_client();
    let rsp = client
        .get_common_properties_error_client()
        .create_for_user_defined_error("test-rg", "resource", resource.try_into().unwrap(), None)
        .await;

    assert_eq!(rsp.unwrap_err().http_status(), Some(StatusCode::BadRequest));
}

#[tokio::test]
async fn get_for_predefined_error() {
    let client = common::create_client();
    let rsp = client
        .get_common_properties_error_client()
        .get_for_predefined_error("test-rg", "resource", None)
        .await;

    assert_eq!(rsp.unwrap_err().http_status(), Some(StatusCode::NotFound));
}
