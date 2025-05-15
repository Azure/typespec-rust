// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_apiverquery::QueryClient;

#[tokio::test]
async fn query_api_version() {
    let client = QueryClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.query_api_version(None).await.unwrap();
}
