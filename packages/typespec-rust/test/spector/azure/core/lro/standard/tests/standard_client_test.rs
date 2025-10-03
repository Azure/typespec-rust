// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::http::poller::{PollerStatus, StatusMonitor};
use azure_core::http::StatusCode;
use futures::StreamExt;

use spector_lrostd::{models::User, StandardClient};

#[tokio::test]
async fn create_or_replace() {
    let client = StandardClient::with_no_credential("http://localhost:3000", None).unwrap();
    let user = User {
        role: Some("contributor".to_string()),
        ..Default::default()
    };

    let mut poller = client
        .create_or_replace("madge", user.try_into().unwrap(), None)
        .unwrap();

    let first_result = poller.next().await;
    assert!(first_result.is_some());
    let first_response = first_result.unwrap().unwrap();
    assert_eq!(first_response.status(), StatusCode::Created);
    let _first_body = first_response.into_body().unwrap();
    //assert_eq!(first_body.status(), PollerStatus::InProgress);

    //let second_result = poller.next().await;
    //assert!(second_result.is_some());
    //let second_response = second_result.unwrap().unwrap();
    //assert_eq!(second_response.status(), StatusCode::Ok);
    //let second_body = second_response.into_body().unwrap();
    //assert_eq!(second_body.status(), PollerStatus::Succeeded);

    //let third_result = poller.next().await;
    //assert!(third_result.is_none());
}

#[tokio::test]
async fn delete() {
    let client = StandardClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut poller = client.delete("madge", None).unwrap();

    let first_result = poller.next().await;
    assert!(first_result.is_some());
    let first_response = first_result.unwrap().unwrap();
    assert_eq!(first_response.status(), StatusCode::Accepted);
    let first_body = first_response.into_body().unwrap();
    assert_eq!(first_body.status(), PollerStatus::InProgress);

    let second_result = poller.next().await;
    assert!(second_result.is_some());
    let second_response = second_result.unwrap().unwrap();
    assert_eq!(second_response.status(), StatusCode::Ok);
    let _second_body = second_response.into_body().unwrap();
    //assert_eq!(second_body.status(), PollerStatus::Succeeded);

    //let third_result = poller.next().await;
    //assert!(third_result.is_none());
}
