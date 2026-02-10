// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_clientinit_individually_parent::IndividuallyParentClient;

#[tokio::test]
async fn with_aliased_name() {
    let client =
        IndividuallyParentClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_individually_parent_individually_parent_nested_with_param_alias_client(
            "sample-blob".to_string(),
        )
        .with_aliased_name(None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_original_name() {
    let client =
        IndividuallyParentClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_individually_parent_individually_parent_nested_with_param_alias_client(
            "sample-blob".to_string(),
        )
        .with_original_name(None)
        .await
        .unwrap();
}
