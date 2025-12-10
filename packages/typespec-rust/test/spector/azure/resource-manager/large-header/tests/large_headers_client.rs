// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::{
    http::{poller::PollerOptions, StatusCode},
    time::Duration,
};
use futures::StreamExt;
use spector_armlargeheader::models::{
    LargeHeaderLargeHeadersClientTwo6KOptions, ResourceProvisioningState,
};

use crate::common::create_client;

mod common;

#[tokio::test]
async fn two6_k() {
    let client = create_client();
    let mut poller = client
        .get_large_header_large_headers_client()
        .two6_k(
            "test-rg",
            "header1",
            Some(LargeHeaderLargeHeadersClientTwo6KOptions {
                method_options: PollerOptions {
                    frequency: Duration::seconds(1),
                    ..Default::default()
                },
                ..Default::default()
            }),
        )
        .unwrap();

    let mut poll_count = 0;
    while let Some(resp) = poller.next().await {
        poll_count += 1;
        let resp = resp.unwrap();
        let http_status = resp.status();
        let status_monitor = resp.into_model().unwrap();
        let poller_status = status_monitor.status.unwrap();
        match poll_count {
            1 => {
                assert_eq!(http_status, StatusCode::Created);
                assert_eq!(
                    poller_status,
                    ResourceProvisioningState::UnknownValue("InProgress".to_string())
                );
            }
            2 => {
                assert_eq!(http_status, StatusCode::Ok);
                assert_eq!(
                    poller_status,
                    ResourceProvisioningState::UnknownValue("InProgress".to_string())
                );
            }
            3 => {
                assert_eq!(http_status, StatusCode::Ok);
                assert_eq!(poller_status, ResourceProvisioningState::Succeeded);
            }
            _ => {
                panic!("unexpected poll count");
            }
        }
    }
}
