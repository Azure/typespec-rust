// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::headers::HeaderName;
use spector_naming::{
    models::{ClientNameAndJsonEncodedNameModel, ClientNameModel, LanguageClientNameModel},
    NamingClient,
};

#[tokio::test]
async fn client() {
    let client = NamingClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ClientNameModel {
        client_name: Some(true),
    };
    client.client(body.try_into().unwrap(), None).await.unwrap();
}

#[tokio::test]
async fn client_name() {
    let client = NamingClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.client_name(None).await.unwrap();
}

#[tokio::test]
async fn compatible_with_encoded_name() {
    let client = NamingClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ClientNameAndJsonEncodedNameModel {
        client_name: Some(true),
    };
    client
        .compatible_with_encoded_name(body.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn language() {
    let client = NamingClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = LanguageClientNameModel {
        rust_name: Some(true),
    };
    client
        .language(body.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn parameter() {
    let client = NamingClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.parameter("true", None).await.unwrap();
}

#[tokio::test]
async fn request() {
    let client = NamingClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.request("true", None).await.unwrap();
}

#[tokio::test]
async fn response() {
    let client = NamingClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client.response(None).await.unwrap();
    let h = resp
        .headers()
        .get_str(&HeaderName::from_static("default-name"))
        .unwrap();
    assert_eq!(h, "true");
}
