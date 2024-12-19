// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use cadl_srvdrivenold::{
    resiliency_service_driven_client::ResiliencyServiceDrivenClientFromOneOptionalOptions,
    ResiliencyServiceDrivenClient,
};

#[async_std::test]
async fn from_none_v1() {
    let client = ResiliencyServiceDrivenClient::with_no_credential(
        "http://localhost:3000",
        "v1".to_string(),
        None,
    )
    .unwrap();
    client.from_none(None).await.unwrap();
}

#[async_std::test]
async fn from_one_optional_v1() {
    let client = ResiliencyServiceDrivenClient::with_no_credential(
        "http://localhost:3000",
        "v1".to_string(),
        None,
    )
    .unwrap();
    client
        .from_one_optional(Some(ResiliencyServiceDrivenClientFromOneOptionalOptions {
            parameter: Some("optional".to_string()),
            ..Default::default()
        }))
        .await
        .unwrap();
}

#[async_std::test]
async fn from_one_required_v1() {
    let client = ResiliencyServiceDrivenClient::with_no_credential(
        "http://localhost:3000",
        "v1".to_string(),
        None,
    )
    .unwrap();
    client
        .from_one_required("required".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn from_none_v2() {
    let client = ResiliencyServiceDrivenClient::with_no_credential(
        "http://localhost:3000",
        "v2".to_string(),
        None,
    )
    .unwrap();
    client.from_none(None).await.unwrap();
}

#[async_std::test]
async fn from_one_optional_v2() {
    let client = ResiliencyServiceDrivenClient::with_no_credential(
        "http://localhost:3000",
        "v2".to_string(),
        None,
    )
    .unwrap();
    client
        .from_one_optional(Some(ResiliencyServiceDrivenClientFromOneOptionalOptions {
            parameter: Some("optional".to_string()),
            ..Default::default()
        }))
        .await
        .unwrap();
}

#[async_std::test]
async fn from_one_required_v2() {
    let client = ResiliencyServiceDrivenClient::with_no_credential(
        "http://localhost:3000",
        "v2".to_string(),
        None,
    )
    .unwrap();
    client
        .from_one_required("required".to_string(), None)
        .await
        .unwrap();
}
