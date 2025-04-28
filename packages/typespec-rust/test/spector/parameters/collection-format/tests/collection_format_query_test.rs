// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_collectionfmt::CollectionFormatClient;

#[tokio::test]
async fn csv() {
    let client = CollectionFormatClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_collection_format_query_client()
        .csv(&["blue", "red", "green"], None)
        .await
        .unwrap();
}

#[tokio::test]
async fn multi() {
    let client = CollectionFormatClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_collection_format_query_client()
        .multi(&["blue", "red", "green"], None)
        .await
        .unwrap();
}

#[tokio::test]
async fn pipes() {
    let client = CollectionFormatClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_collection_format_query_client()
        .pipes(&["blue", "red", "green"], None)
        .await
        .unwrap();
}

#[tokio::test]
async fn ssv() {
    let client = CollectionFormatClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_collection_format_query_client()
        .ssv(&["blue", "red", "green"], None)
        .await
        .unwrap();
}
