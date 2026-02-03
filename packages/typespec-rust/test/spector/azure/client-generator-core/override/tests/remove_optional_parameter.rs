// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_coreoverride::{models::OverrideRemoveOptionalParameterClientRemoveOptionalOptions, OverrideClient};

#[tokio::test]
async fn remove_optional() {
    let client = OverrideClient::with_no_credential("http://localhost:3000", None).unwrap();
    let options = OverrideRemoveOptionalParameterClientRemoveOptionalOptions {
        param2: Some("param2".to_string()),
        ..Default::default()
    };
    client
        .get_override_remove_optional_parameter_client()
        .remove_optional("param1", Some(options))
        .await
        .unwrap();
}
