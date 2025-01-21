// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_naming::{
    models::{ClientModel, RustName},
    NamingClient,
};

#[tokio::test]
async fn client() {
    let client = NamingClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut body = ClientModel::default();
    body.default_name = Some(true);
    client
        .get_naming_client_model_client()
        .client(body.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn language() {
    let client = NamingClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut body = RustName::default();
    body.default_name = Some(true);
    client
        .get_naming_client_model_client()
        .language(body.try_into().unwrap(), None)
        .await
        .unwrap();
}
