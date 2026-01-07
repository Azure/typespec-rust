// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::http::RequestContent;
use spector_mediatype::MediaTypeClient;

#[tokio::test]
async fn get_as_json() {
    let client = MediaTypeClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_media_type_string_body_client()
        .get_as_json(None)
        .await
        .unwrap();
    let resp = resp.into_model().unwrap();
    assert_eq!(resp, "foo".to_string());
}

#[tokio::test]
async fn get_as_text() {
    let client = MediaTypeClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_media_type_string_body_client()
        .get_as_text(None)
        .await
        .unwrap();
    let resp = resp.into_body().into_string().unwrap();
    assert_eq!(resp, "{cat}".to_string());
}

#[tokio::test]
async fn send_as_json() {
    let client = MediaTypeClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_media_type_string_body_client()
        .send_as_json("foo".try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn send_as_text() {
    let client = MediaTypeClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_media_type_string_body_client()
        .send_as_text(RequestContent::from_str("{cat}"), None)
        .await
        .unwrap();
}
