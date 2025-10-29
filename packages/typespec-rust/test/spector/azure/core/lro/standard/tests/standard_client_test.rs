// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::http::poller::{PollerOptions, PollerStatus, StatusMonitor};
use azure_core::http::StatusCode;
use azure_core::time::Duration;
use futures::StreamExt;

use spector_lrostd::{
    models::{
        StandardClientCreateOrReplaceOptions, StandardClientDeleteOptions,
        StandardClientExportOptions, User,
    },
    StandardClient,
};

#[tokio::test]
async fn create_or_replace() {
    let client = StandardClient::with_no_credential("http://localhost:3000", None).unwrap();
    let user = User {
        role: Some("contributor".to_string()),
        ..Default::default()
    };

    let mut poller = client
        .create_or_replace(
            "madge",
            user.try_into().unwrap(),
            Some(StandardClientCreateOrReplaceOptions {
                poller_options: PollerOptions {
                    frequency: Some(Duration::seconds(1)),
                },
                ..Default::default()
            }),
        )
        .unwrap();

    let mut poll_count = 0;
    while let Some(result) = poller.next().await {
        poll_count += 1;
        let result = result.unwrap();
        let status = result.status();
        let result = result.into_body().unwrap();
        match poll_count {
            1 => {
                assert_eq!(status, StatusCode::Created);
                assert_eq!(result.status(), PollerStatus::InProgress);
            }
            2 => {
                assert_eq!(status, StatusCode::Ok);
                assert_eq!(result.status(), PollerStatus::InProgress);
            }
            3 => {
                assert_eq!(status, StatusCode::Ok);
                assert_eq!(result.status(), PollerStatus::Succeeded);
            }
            _ => {
                panic!("unexpected poll count");
            }
        }
    }
}

#[tokio::test]
async fn delete() {
    let client = StandardClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut poller = client
        .delete(
            "madge",
            Some(StandardClientDeleteOptions {
                poller_options: PollerOptions {
                    frequency: Some(Duration::seconds(1)),
                },
                ..Default::default()
            }),
        )
        .unwrap();

    let mut poll_count = 0;
    while let Some(result) = poller.next().await {
        poll_count += 1;
        let result = result.unwrap();
        let status = result.status();
        let result = result.into_body().unwrap();
        match poll_count {
            1 => {
                assert_eq!(status, StatusCode::Accepted);
                assert_eq!(result.status(), PollerStatus::InProgress);
            }
            2 => {
                assert_eq!(status, StatusCode::Ok);
                assert_eq!(result.status(), PollerStatus::InProgress);
            }
            3 => {
                assert_eq!(status, StatusCode::Ok);
                assert_eq!(result.status(), PollerStatus::Succeeded);
            }
            _ => {
                panic!("unexpected poll count");
            }
        }
    }
}

#[tokio::test]
async fn export() {
    let client = StandardClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut poller = client
        .export(
            "madge",
            "json",
            Some(StandardClientExportOptions {
                poller_options: PollerOptions {
                    frequency: Some(Duration::seconds(1)),
                },
                ..Default::default()
            }),
        )
        .unwrap();

    let mut poll_count = 0;
    while let Some(result) = poller.next().await {
        poll_count += 1;
        let result = result.unwrap();
        let status = result.status();
        let result = result.into_body().unwrap();
        match poll_count {
            1 => {
                assert_eq!(status, StatusCode::Accepted);
                assert_eq!(result.status(), PollerStatus::InProgress);
            }
            2 => {
                assert_eq!(status, StatusCode::Ok);
                assert_eq!(result.status(), PollerStatus::InProgress);
            }
            3 => {
                assert_eq!(status, StatusCode::Ok);
                assert_eq!(result.status(), PollerStatus::Succeeded);
                match result.result {
                    Some(user) => {
                        assert_eq!(user.name, Some("madge".to_string()));
                        assert_eq!(user.resource_uri, Some("/users/madge".to_string()));
                    }
                    None => panic!("expected result"),
                }
            }
            _ => {
                panic!("unexpected poll count");
            }
        }
    }
}
