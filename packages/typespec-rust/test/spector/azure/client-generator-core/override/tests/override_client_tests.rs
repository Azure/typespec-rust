// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_coreoverride::models::{
    GroupParametersOptions, OverrideRemoveOptionalParameterClientRemoveOptionalOptions,
};
use spector_coreoverride::OverrideClient;

#[tokio::test]
async fn group_parameters() {
    let client = OverrideClient::with_no_credential("http://localhost:3000", None).unwrap();
    let group = GroupParametersOptions {
        param1: "param1",
        param2: "param2",
    };
    client
        .get_override_group_parameters_client()
        .group(group, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn remove_optional_parameter() {
    let client = OverrideClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_override_remove_optional_parameter_client()
        .remove_optional(
            "param1",
            Some(OverrideRemoveOptionalParameterClientRemoveOptionalOptions {
                param2: Some("param2".to_string()),
                ..Default::default()
            }),
        )
        .await
        .unwrap();
}

#[tokio::test]
async fn reorder_parameters() {
    let client = OverrideClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_override_reorder_parameters_client()
        .reorder("param1", "param2", None)
        .await
        .unwrap();
}

#[tokio::test]
async fn require_optional_parameter() {
    let client = OverrideClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_override_require_optional_parameter_client()
        .require_optional("param1", "param2", None)
        .await
        .unwrap();
}
