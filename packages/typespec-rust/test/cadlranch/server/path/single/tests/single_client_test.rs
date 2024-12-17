// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use cadl_single::SingleClient;

#[async_std::test]
async fn my_op() {
    let client = SingleClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.my_op(None).await.unwrap();
}
