// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_multiple::MultipleClient;

#[async_std::test]
async fn no_operation_params() {
    let client = MultipleClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.no_operation_params(None).await.unwrap();
}

#[async_std::test]
async fn with_operation_path_param() {
    let client = MultipleClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .with_operation_path_param("test".to_string(), None)
        .await
        .unwrap();
}
