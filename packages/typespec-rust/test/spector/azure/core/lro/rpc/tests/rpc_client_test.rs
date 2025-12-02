// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::http::poller::{PollerOptions, PollerStatus, StatusMonitor};
use azure_core::http::RequestContent;
use azure_core::http::StatusCode;
use azure_core::time::Duration;
use futures::StreamExt;

use spector_lrorpc::{
    models::{GenerationOptions, RpcClientLongRunningRpcOptions},
    RpcClient,
};

#[tokio::test]
async fn long_running_rpc() {
    let client = RpcClient::with_no_credential("http://localhost:3000", None).unwrap();

    let body: RequestContent<GenerationOptions> = GenerationOptions {
        prompt: Some("text".to_string()),
    }
    .try_into()
    .unwrap();

    let options = Some(RpcClientLongRunningRpcOptions {
        method_options: PollerOptions {
            frequency: Duration::seconds(1),
            ..Default::default()
        },
    });

    let mut poller = client
        .long_running_rpc(body.clone(), options.clone())
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

    let poller = client.long_running_rpc(body, options).unwrap();
    let final_result = poller.await.unwrap().into_model().unwrap();
    assert_eq!(final_result.data, Some("text data".to_string()));
}
