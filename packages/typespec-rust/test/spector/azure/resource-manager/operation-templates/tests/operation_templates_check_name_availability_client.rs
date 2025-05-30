// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

mod common;

use spector_armoptemplates::models::CheckNameAvailabilityRequest;

#[tokio::test]
async fn check_global() {
    let client = common::create_client();
    let request = CheckNameAvailabilityRequest {
        name: Some("checkName".to_string()),
        type_prop: Some("Microsoft.Web/site".to_string()),
    };

    client
        .get_operation_templates_check_name_availability_client()
        .check_global(request.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn check_local() {
    // Create client
    let client = common::create_client();

    // Create the request
    let request = CheckNameAvailabilityRequest {
        name: Some("checkName".to_string()),
        type_prop: Some("Microsoft.Web/site".to_string()),
    };

    client
        .get_operation_templates_check_name_availability_client()
        .check_local("test-rg", request.try_into().unwrap(), None)
        .await
        .unwrap();
}
