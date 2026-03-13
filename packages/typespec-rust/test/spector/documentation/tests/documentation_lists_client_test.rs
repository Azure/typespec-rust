// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_documentation::{
    lists::models::{BulletPointsEnum, BulletPointsModel},
    DocumentationClient,
};

#[tokio::test]
async fn bullet_points_model_returns_200() {
    let client = DocumentationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = BulletPointsModel {
        prop: Some(BulletPointsEnum::Simple),
    };
    let resp = client
        .get_documentation_lists_client()
        .bullet_points_model(input, None)
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        200,
        "bullet_points_model should return 200 OK"
    );
}

#[tokio::test]
async fn bullet_points_model_with_bold_enum() {
    let model = BulletPointsModel {
        prop: Some(BulletPointsEnum::Bold),
    };
    assert_eq!(model.prop, Some(BulletPointsEnum::Bold));
}

#[tokio::test]
async fn bullet_points_model_with_enum_prop() {
    // Verify the model can be sent with an enum value set.
    let client = DocumentationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = BulletPointsModel {
        prop: Some(BulletPointsEnum::Simple),
    };
    let resp = client
        .get_documentation_lists_client()
        .bullet_points_model(input, None)
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        200,
        "bullet_points_model with enum prop should return 200 OK"
    );
}

#[tokio::test]
async fn bullet_points_model_with_italic_enum() {
    let model = BulletPointsModel {
        prop: Some(BulletPointsEnum::Italic),
    };
    assert_eq!(model.prop, Some(BulletPointsEnum::Italic));
}

#[tokio::test]
async fn bullet_points_op_returns_204() {
    let client = DocumentationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_documentation_lists_client()
        .bullet_points_op(None)
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        204,
        "bullet_points_op should return 204 No Content"
    );
}

#[tokio::test]
async fn numbered_returns_204() {
    let client = DocumentationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_documentation_lists_client()
        .numbered(None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 204, "numbered should return 204 No Content");
}
