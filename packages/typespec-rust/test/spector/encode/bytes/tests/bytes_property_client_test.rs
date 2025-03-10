// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_bytes::{
    models::{
        Base64BytesProperty, Base64urlArrayBytesProperty, Base64urlBytesProperty,
        DefaultBytesProperty,
    },
    BytesClient,
};

#[tokio::test]
async fn base64() {
    let client = BytesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = Base64BytesProperty {
        value: Some("test".as_bytes().to_owned()),
    };
    let resp = client
        .get_bytes_property_client()
        .base64(input.try_into().unwrap(), None)
        .await
        .unwrap();
    let output: Base64BytesProperty = resp.into_body().await.unwrap();
    assert_eq!(output.value, Some("test".as_bytes().to_owned()));
}

#[tokio::test]
async fn base64_url() {
    let client = BytesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = Base64urlBytesProperty {
        value: Some("test".as_bytes().to_owned()),
    };
    let resp = client
        .get_bytes_property_client()
        .base64_url(input.try_into().unwrap(), None)
        .await
        .unwrap();
    let output: Base64urlBytesProperty = resp.into_body().await.unwrap();
    assert_eq!(output.value, Some("test".as_bytes().to_owned()));
}

#[tokio::test]
async fn base64_url_array() {
    let client = BytesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = Base64urlArrayBytesProperty {
        value: vec!["test".as_bytes().to_owned(), "test".as_bytes().to_owned()],
    };
    let resp = client
        .get_bytes_property_client()
        .base64_url_array(input.try_into().unwrap(), None)
        .await
        .unwrap();
    let output: Base64urlArrayBytesProperty = resp.into_body().await.unwrap();
    assert_eq!(
        output.value,
        vec!["test".as_bytes().to_owned(), "test".as_bytes().to_owned()]
    );
}

#[tokio::test]
async fn default() {
    let client = BytesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = DefaultBytesProperty {
        value: Some("test".as_bytes().to_owned()),
    };
    let resp = client
        .get_bytes_property_client()
        .default(input.try_into().unwrap(), None)
        .await
        .unwrap();
    let output: DefaultBytesProperty = resp.into_body().await.unwrap();
    assert_eq!(output.value, Some("test".as_bytes().to_owned()));
}
