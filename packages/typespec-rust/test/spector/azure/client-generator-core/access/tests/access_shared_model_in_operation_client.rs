// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_access::AccessClient;

#[tokio::test]
async fn shared_model_in_operation_public() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_access_shared_model_in_operation_client()
        .public("sample", None)
        .await
        .unwrap();
    let model = resp.into_model().unwrap();
    assert_eq!(model.name, Some("sample".to_string()));
}
