// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_clientloc_move4::MoveToRootClient;

#[tokio::test]
async fn test_get_health_status() {
    let client = MoveToRootClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.get_health_status(None).await.unwrap();
}
