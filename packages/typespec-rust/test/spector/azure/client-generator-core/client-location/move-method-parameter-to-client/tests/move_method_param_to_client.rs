// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_clientloc_move1::{models::Blob, MoveMethodParameterToClient};

#[tokio::test]
async fn test_get_blob() {
    let client = MoveMethodParameterToClient::with_no_credential(
        "http://localhost:3000",
        "testaccount".to_string(),
        None,
    )
    .unwrap();
    let result = client
        .get_move_method_parameter_to_blob_operations_client()
        .get_blob("testcontainer", "testblob.txt", None)
        .await
        .unwrap();
    let blob: Blob = result.into_model().unwrap();
    assert_eq!(blob.id, Some("blob-001".to_string()));
    assert_eq!(blob.name, Some("testblob.txt".to_string()));
    assert_eq!(blob.size, Some(1024));
    assert_eq!(blob.path, Some("/testcontainer/testblob.txt".to_string()));
}
