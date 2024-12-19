// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use cadl_contentneg::{models::PngImageAsJson, ContentNegotiationClient};
use std::fs;

#[async_std::test]
async fn get_avatar_as_json() {
    let client =
        ContentNegotiationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_content_negotiation_different_body_client()
        .get_avatar_as_json(None)
        .await
        .unwrap();
    let result: PngImageAsJson = resp.try_into().unwrap();
    let image_png =
        fs::read("../../../../node_modules/@azure-tools/cadl-ranch-specs/assets/image.png")
            .unwrap();
    assert_eq!(result.content, Some(image_png));
}

#[async_std::test]
async fn get_avatar_as_png() {
    let client =
        ContentNegotiationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_content_negotiation_different_body_client()
        .get_avatar_as_png(None)
        .await
        .unwrap();
    let body = resp.into_raw_body().collect().await.unwrap();
    let image_png =
        fs::read("../../../../node_modules/@azure-tools/cadl-ranch-specs/assets/image.png")
            .unwrap();
    assert_eq!(body, image_png);
}
