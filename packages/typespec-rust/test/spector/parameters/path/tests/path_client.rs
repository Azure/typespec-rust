// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_path::{models::PathClientOptionalOptions, PathClient};

#[tokio::test]
async fn normal() {
    let client = PathClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.normal("foo", None).await.unwrap();
}

#[tokio::test]
async fn optional_none() {
    let client = PathClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.optional(None).await.unwrap();
}

#[tokio::test]
async fn optional_some() {
    let client = PathClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .optional(Some(PathClientOptionalOptions {
            name: Some("foo".to_string()),
            ..Default::default()
        }))
        .await
        .unwrap();
}
