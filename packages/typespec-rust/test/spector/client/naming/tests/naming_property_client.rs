// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_naming::{
    property::models::{
        ClientNameAndJsonEncodedNameModel, ClientNameModel, LanguageClientNameModel,
    },
    NamingClient,
};

#[tokio::test]
async fn client() {
    let client = NamingClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ClientNameModel {
        client_name: Some(true),
    };
    client
        .get_naming_property_client()
        .client(body.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn compatible_with_encoded_name() {
    let client = NamingClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ClientNameAndJsonEncodedNameModel {
        client_name: Some(true),
    };
    client
        .get_naming_property_client()
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
        .get_naming_property_client()
        .language(body.try_into().unwrap(), None)
        .await
        .unwrap();
}
