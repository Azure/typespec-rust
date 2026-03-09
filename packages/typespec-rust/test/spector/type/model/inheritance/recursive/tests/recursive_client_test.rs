// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_recursive::{models::Extension, RecursiveClient};

#[tokio::test]
async fn get() {
    let client = RecursiveClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.get(None).await.unwrap();
}

#[tokio::test]
async fn put() {
    let client = RecursiveClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = Extension {
        level: Some(0),
        extension: Some(vec![Extension {
            level: Some(1),
            extension: Some(vec![Extension {
                level: Some(2),
                extension: None,
            }]),
        }]),
    };
    client.put(input.try_into().unwrap(), None).await.unwrap();
}
