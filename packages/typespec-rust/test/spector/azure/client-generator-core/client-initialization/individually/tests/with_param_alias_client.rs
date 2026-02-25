// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_clientinit_individually::IndividuallyNestedWithParamAliasClient;

#[tokio::test]
async fn with_aliased_name() {
    let client = IndividuallyNestedWithParamAliasClient::with_no_credential(
        "http://localhost:3000",
        "sample-blob".to_string(),
        None,
    )
    .unwrap();
    client.with_aliased_name(None).await.unwrap();
}

#[tokio::test]
async fn with_original_name() {
    let client = IndividuallyNestedWithParamAliasClient::with_no_credential(
        "http://localhost:3000",
        "sample-blob".to_string(),
        None,
    )
    .unwrap();
    client.with_original_name(None).await.unwrap();
}
