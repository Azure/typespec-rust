// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::{
    http::{
        poller::{PollerOptions, PollerStatus, StatusMonitor},
        StatusCode,
    },
    time::Duration,
};
use futures::StreamExt;

use spector_armlargeheader::models::LargeHeaderLargeHeadersClientTwo6KOptions;

use crate::common::create_client;

mod common;

#[tokio::test]
async fn two6_k() {
    let client = create_client().get_large_header_large_headers_client();

    let options = Some(LargeHeaderLargeHeadersClientTwo6KOptions {
        method_options: PollerOptions {
            frequency: Duration::seconds(1),
            ..Default::default()
        },
    });

    let mut poller = client
        .two6_k("test-rg", "header1", options.clone())
        .unwrap();

    let mut poll_count = 0;
    while let Some(result) = poller.next().await {
        poll_count += 1;
        let response = result.unwrap();
        let http_status = response.status();
        let status_monitor = response.into_model().unwrap();
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

    let poller = client.two6_k("test-rg", "header1", options).unwrap();
    let final_result = poller.await.unwrap().into_model().unwrap();
    assert_eq!(final_result.succeeded, Some(true));
}
