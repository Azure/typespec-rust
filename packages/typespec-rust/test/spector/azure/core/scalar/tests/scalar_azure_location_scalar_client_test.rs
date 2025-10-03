// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::http::RequestContent;
use spector_corescalar::{models::AzureLocationModel, ScalarClient};

#[tokio::test]
async fn get_azure_location() {
    let client = ScalarClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_scalar_azure_location_scalar_client()
        .get(None)
        .await
        .unwrap();
    let location: String = resp.into_body().unwrap();
    assert_eq!(location, "eastus");
}

#[tokio::test]
async fn put_azure_location() {
    let client = ScalarClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = RequestContent::try_from("eastus".to_string()).unwrap();
    client
        .get_scalar_azure_location_scalar_client()
        .put(body, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn post_azure_location_model() {
    let client = ScalarClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input_model = AzureLocationModel {
        location: Some("eastus".to_string()),
    };
    let body = RequestContent::try_from(input_model).unwrap();
    let resp = client
        .get_scalar_azure_location_scalar_client()
        .post(body, None)
        .await
        .unwrap();
    let response_model: AzureLocationModel = resp.into_body().unwrap();
    assert_eq!(response_model.location, Some("eastus".to_string()));
}

#[tokio::test]
async fn header_azure_location() {
    let client = ScalarClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_scalar_azure_location_scalar_client()
        .header("eastus".to_string(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn query_azure_location() {
    let client = ScalarClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_scalar_azure_location_scalar_client()
        .query("eastus", None)
        .await
        .unwrap();
}
