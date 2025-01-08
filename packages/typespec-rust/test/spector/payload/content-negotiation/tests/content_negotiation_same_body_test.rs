// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_contentneg::ContentNegotiationClient;
use std::fs;

#[async_std::test]
async fn get_avatar_as_jpeg() {
    let client =
        ContentNegotiationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_content_negotiation_same_body_client()
        .get_avatar_as_jpeg(None)
        .await
        .unwrap();
    let body = resp.into_raw_body().collect().await.unwrap();
    let image_jpg =
        fs::read("../../../../node_modules/@azure-tools/cadl-ranch-specs/assets/image.jpg")
            .unwrap();
    assert_eq!(body, image_jpg)
}

#[async_std::test]
async fn get_avatar_as_png() {
    let client =
        ContentNegotiationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_content_negotiation_same_body_client()
        .get_avatar_as_png(None)
        .await
        .unwrap();
    let body = resp.into_raw_body().collect().await.unwrap();
    let image_png =
        fs::read("../../../../node_modules/@azure-tools/cadl-ranch-specs/assets/image.png")
            .unwrap();
    assert_eq!(body, image_png)
}
