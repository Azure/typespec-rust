// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_coreoverride::OverrideClient;

#[tokio::test]
async fn reorder() {
    let client = OverrideClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_override_reorder_parameters_client()
        .reorder("param1", "param2", None)
        .await
        .unwrap();
}
