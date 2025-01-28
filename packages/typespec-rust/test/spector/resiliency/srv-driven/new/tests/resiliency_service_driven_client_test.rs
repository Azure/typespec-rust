// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_srvdrivennew::{
    ResiliencyServiceDrivenClient, ResiliencyServiceDrivenClientFromNoneOptions,
    ResiliencyServiceDrivenClientFromOneOptionalOptions,
    ResiliencyServiceDrivenClientFromOneRequiredOptions, ResiliencyServiceDrivenClientOptions,
};

#[tokio::test]
async fn add_operation() {
    let client = ResiliencyServiceDrivenClient::with_no_credential(
        "http://localhost:3000",
        "v2".to_string(),
        None,
    )
    .unwrap();
    client.add_operation(None).await.unwrap();
}

#[tokio::test]
async fn from_none_v1() {
    let client = ResiliencyServiceDrivenClient::with_no_credential(
        "http://localhost:3000",
        "v2".to_string(),
        Some(ResiliencyServiceDrivenClientOptions {
            api_version: "v1".to_string(),
            ..Default::default()
        }),
    )
    .unwrap();
    client
        .from_none(Some(ResiliencyServiceDrivenClientFromNoneOptions {
            new_parameter: Some("new".to_string()),
            ..Default::default()
        }))
        .await
        .unwrap();
}

#[tokio::test]
async fn from_one_optional_v1() {
    let client = ResiliencyServiceDrivenClient::with_no_credential(
        "http://localhost:3000",
        "v2".to_string(),
        Some(ResiliencyServiceDrivenClientOptions {
            api_version: "v1".to_string(),
            ..Default::default()
        }),
    )
    .unwrap();
    client
        .from_one_optional(Some(ResiliencyServiceDrivenClientFromOneOptionalOptions {
            new_parameter: Some("new".to_string()),
            parameter: Some("optional".to_string()),
            ..Default::default()
        }))
        .await
        .unwrap();
}

#[tokio::test]
async fn from_one_required_v1() {
    let client = ResiliencyServiceDrivenClient::with_no_credential(
        "http://localhost:3000",
        "v2".to_string(),
        Some(ResiliencyServiceDrivenClientOptions {
            api_version: "v1".to_string(),
            ..Default::default()
        }),
    )
    .unwrap();
    client
        .from_one_required(
            "required",
            Some(ResiliencyServiceDrivenClientFromOneRequiredOptions {
                new_parameter: Some("new".to_string()),
                ..Default::default()
            }),
        )
        .await
        .unwrap();
}

#[tokio::test]
async fn from_none_v2() {
    let client = ResiliencyServiceDrivenClient::with_no_credential(
        "http://localhost:3000",
        "v2".to_string(),
        None,
    )
    .unwrap();
    client
        .from_none(Some(ResiliencyServiceDrivenClientFromNoneOptions {
            new_parameter: Some("new".to_string()),
            ..Default::default()
        }))
        .await
        .unwrap();
}

#[tokio::test]
async fn from_one_optional_v2() {
    let client = ResiliencyServiceDrivenClient::with_no_credential(
        "http://localhost:3000",
        "v2".to_string(),
        None,
    )
    .unwrap();
    client
        .from_one_optional(Some(ResiliencyServiceDrivenClientFromOneOptionalOptions {
            new_parameter: Some("new".to_string()),
            parameter: Some("optional".to_string()),
            ..Default::default()
        }))
        .await
        .unwrap();
}

#[tokio::test]
async fn from_one_required_v2() {
    let client = ResiliencyServiceDrivenClient::with_no_credential(
        "http://localhost:3000",
        "v2".to_string(),
        None,
    )
    .unwrap();
    client
        .from_one_required(
            "required",
            Some(ResiliencyServiceDrivenClientFromOneRequiredOptions {
                new_parameter: Some("new".to_string()),
                ..Default::default()
            }),
        )
        .await
        .unwrap();
}
