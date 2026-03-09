// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_query::QueryClient;

#[tokio::test]
async fn post() {
    let client = QueryClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_query_constant_client()
        .post(None)
        .await
        .unwrap();
}
