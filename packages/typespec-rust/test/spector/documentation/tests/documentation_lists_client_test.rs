// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_documentation::{lists::models::BulletPointsModel, DocumentationClient};

#[tokio::test]
async fn bullet_points_model() {
    let client = DocumentationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = BulletPointsModel { prop: None };
    client
        .get_documentation_lists_client()
        .bullet_points_model(input, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn bullet_points_op() {
    let client = DocumentationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_documentation_lists_client()
        .bullet_points_op(None)
        .await
        .unwrap();
}

#[tokio::test]
async fn numbered() {
    let client = DocumentationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_documentation_lists_client()
        .numbered(None)
        .await
        .unwrap();
}
