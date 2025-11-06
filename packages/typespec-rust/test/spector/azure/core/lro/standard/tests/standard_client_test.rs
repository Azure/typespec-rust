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
                method_options: PollerOptions {
                    frequency: Duration::seconds(1),
                    ..Default::default()
                },
                ..Default::default()
            }),
        )
        .unwrap();

    let mut poll_count = 0;
    while let Some(result) = poller.next().await {
        poll_count += 1;
        let response = result.unwrap();
        let http_status = response.status();
        let status_monitor = response.into_body().unwrap();
        let poller_status = status_monitor.status();
        match poll_count {
            1 => {
                assert_eq!(http_status, StatusCode::Created);
                assert_eq!(poller_status, PollerStatus::InProgress);
            }
            2 => {
                assert_eq!(http_status, StatusCode::Ok);
                assert_eq!(poller_status, PollerStatus::InProgress);
            }
            3 => {
                assert_eq!(http_status, StatusCode::Ok);
                assert_eq!(poller_status, PollerStatus::Succeeded);
            }
            _ => {
                panic!("unexpected poll count");
            }
        }
    }
    assert_eq!(poll_count, 3);

    let user = User {
        role: Some("contributor".to_string()),
        ..Default::default()
    };
    let poller = client
        .create_or_replace(
            "madge",
            user.try_into().unwrap(),
            Some(StandardClientCreateOrReplaceOptions {
                method_options: PollerOptions {
                    frequency: Duration::seconds(1),
                    ..Default::default()
                },
                ..Default::default()
            }),
        )
        .unwrap();
    let final_result = poller.await.unwrap().into_body().unwrap();
    assert_eq!(final_result.name, Some("madge".to_string()));
    assert_eq!(final_result.role, Some("contributor".to_string()));
}

#[tokio::test]
async fn delete() {
    let client = StandardClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut poller = client
        .delete(
            "madge",
            Some(StandardClientDeleteOptions {
                method_options: PollerOptions {
                    frequency: Duration::seconds(1),
                    ..Default::default()
                },
                ..Default::default()
            }),
        )
        .unwrap();

    let mut poll_count = 0;
    while let Some(result) = poller.next().await {
        poll_count += 1;
        let response = result.unwrap();
        let http_status = response.status();
        let status_monitor = response.into_body().unwrap();
        let poller_status = status_monitor.status();
        match poll_count {
            1 => {
                assert_eq!(http_status, StatusCode::Accepted);
                assert_eq!(poller_status, PollerStatus::InProgress);
            }
            2 => {
                assert_eq!(http_status, StatusCode::Ok);
                assert_eq!(poller_status, PollerStatus::InProgress);
            }
            3 => {
                assert_eq!(http_status, StatusCode::Ok);
                assert_eq!(poller_status, PollerStatus::Succeeded);
            }
            _ => {
                panic!("unexpected poll count");
            }
        }
    }
    assert_eq!(poll_count, 3);
}

#[tokio::test]
async fn export() {
    let client = StandardClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut poller = client
        .export(
            "madge",
            "json",
            Some(StandardClientExportOptions {
                method_options: PollerOptions {
                    frequency: Duration::seconds(1),
                    ..Default::default()
                },
                ..Default::default()
            }),
        )
        .unwrap();

    let mut poll_count = 0;
    while let Some(result) = poller.next().await {
        poll_count += 1;
        let response = result.unwrap();
        let http_status = response.status();
        let status_monitor = response.into_body().unwrap();
        let poller_status = status_monitor.status();
        match poll_count {
            1 => {
                assert_eq!(http_status, StatusCode::Accepted);
                assert_eq!(poller_status, PollerStatus::InProgress);
            }
            2 => {
                assert_eq!(http_status, StatusCode::Ok);
                assert_eq!(poller_status, PollerStatus::InProgress);
            }
            3 => {
                assert_eq!(http_status, StatusCode::Ok);
                assert_eq!(poller_status, PollerStatus::Succeeded);
            }
            _ => {
                panic!("unexpected poll count");
            }
        }
    }
    assert_eq!(poll_count, 3);

    let client = StandardClient::with_no_credential("http://localhost:3000", None).unwrap();
    let poller = client
        .export(
            "madge",
            "json",
            Some(StandardClientExportOptions {
                method_options: PollerOptions {
                    frequency: Duration::seconds(1),
                    ..Default::default()
                },
                ..Default::default()
            }),
        )
        .unwrap();
    let final_result = poller.await.unwrap().into_body().unwrap();
    assert_eq!(final_result.name, Some("madge".to_string()));
    assert_eq!(final_result.resource_uri, Some("/users/madge".to_string()));
}
