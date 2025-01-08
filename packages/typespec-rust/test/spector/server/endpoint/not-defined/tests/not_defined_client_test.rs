// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_noendpoint::NotDefinedClient;

#[tokio::test]
async fn valid() {
    let client = NotDefinedClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.valid(None).await.unwrap();
}
