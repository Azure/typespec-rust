// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_clientloc_move3::MoveToNewSubClient;

#[tokio::test]
async fn test_list_products() {
    let client = MoveToNewSubClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_move_to_new_sub_product_operations_client()
        .list_products(None)
        .await
        .unwrap();
}
