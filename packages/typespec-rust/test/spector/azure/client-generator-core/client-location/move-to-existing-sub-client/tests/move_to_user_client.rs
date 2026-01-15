// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_clientloc_move2::MoveToExistingSubClient;

#[tokio::test]
async fn test_get_user() {
    let client =
        MoveToExistingSubClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_move_to_existing_sub_user_operations_client()
        .get_user(None)
        .await
        .unwrap();
}
