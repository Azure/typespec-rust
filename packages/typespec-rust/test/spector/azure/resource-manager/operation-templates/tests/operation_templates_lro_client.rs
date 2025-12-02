// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

mod common;

use azure_core::{
    http::{
        poller::{PollerOptions, PollerStatus, StatusMonitor},
        RequestContent, StatusCode,
    },
    time::{Duration, OffsetDateTime},
};

use time::{Date, Month, Time};

use futures::StreamExt;

use spector_armoptemplates::models::{
    CreatedByType, ExportRequest, OperationTemplatesLroClientCreateOrReplaceOptions,
    OperationTemplatesLroClientDeleteOptions, OperationTemplatesLroClientExportOptions, Order,
    OrderProperties,
};

#[tokio::test]
async fn create_or_replace() {
    let client = common::create_client().get_operation_templates_lro_client();

    let create_or_replace_request: RequestContent<Order> = Order {
        location: Some("eastus".to_string()),
        properties: Some(OrderProperties {
            product_id: Some("product1".to_string()),
            amount: Some(1),
            ..Default::default()
        }),
        ..Default::default()
    }
    .try_into()
    .unwrap();

    let options = Some(OperationTemplatesLroClientCreateOrReplaceOptions {
        method_options: PollerOptions {
            frequency: Duration::seconds(1),
            ..Default::default()
        },
    });

    let mut poller = client
        .create_or_replace(
            "test-rg",
            "order1",
            create_or_replace_request.clone(),
            options.clone(),
        )
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

    let poller = client
        .create_or_replace("test-rg", "order1", create_or_replace_request, options)
        .unwrap();
    let final_result = poller.await.unwrap().into_model().unwrap();

    assert_eq!(final_result.id, Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Azure.ResourceManager.OperationTemplates/orders/order1".to_string()));
    assert_eq!(final_result.name, Some("order1".to_string()));
    assert_eq!(
        final_result.type_prop,
        Some("Azure.ResourceManager.Resources/orders".to_string())
    );
    assert_eq!(final_result.location, Some("eastus".to_string()));

    assert!(final_result.properties.is_some());
    assert_eq!(
        final_result.properties.as_ref().unwrap().product_id,
        Some("product1".to_string())
    );
    assert_eq!(final_result.properties.as_ref().unwrap().amount, Some(1));
    assert_eq!(
        final_result.properties.as_ref().unwrap().provisioning_state,
        Some("Succeeded".to_string())
    );

    assert!(final_result.system_data.is_some());
    assert_eq!(
        final_result.system_data.as_ref().unwrap().created_by,
        Some("AzureSDK".to_string())
    );
    assert_eq!(
        final_result.system_data.as_ref().unwrap().created_by_type,
        Some(CreatedByType::User)
    );
    assert_eq!(
        final_result.system_data.as_ref().unwrap().created_at,
        Some(OffsetDateTime::new_utc(
            Date::from_calendar_date(2024, Month::October, 4).unwrap(),
            Time::from_hms_milli(0, 56, 7, 442).unwrap(),
        ))
    );
    assert_eq!(
        final_result.system_data.as_ref().unwrap().last_modified_by,
        Some("AzureSDK".to_string())
    );
    assert_eq!(
        final_result
            .system_data
            .as_ref()
            .unwrap()
            .last_modified_by_type,
        Some(CreatedByType::User)
    );
    assert_eq!(
        final_result.system_data.as_ref().unwrap().last_modified_at,
        Some(OffsetDateTime::new_utc(
            Date::from_calendar_date(2024, Month::October, 4).unwrap(),
            Time::from_hms_milli(0, 56, 7, 442).unwrap(),
        ))
    );

    assert_eq!(final_result.tags, None);
}

#[tokio::test]
async fn lro_client_delete() {
    let client = common::create_client().get_operation_templates_lro_client();

    let options = Some(OperationTemplatesLroClientDeleteOptions {
        method_options: PollerOptions {
            frequency: Duration::seconds(1),
            ..Default::default()
        },
    });

    let mut poller = client.delete("test-rg", "order1", options).unwrap();

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
                assert_eq!(http_status, StatusCode::Accepted);
                assert_eq!(poller_status, PollerStatus::InProgress);
            }
            3 => {
                assert_eq!(http_status, StatusCode::NoContent);
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
async fn lro_client_export() {
    let client = common::create_client().get_operation_templates_lro_client();

    let export_request: RequestContent<ExportRequest> = ExportRequest {
        format: Some("csv".to_string()),
    }
    .try_into()
    .unwrap();

    let options = Some(OperationTemplatesLroClientExportOptions {
        method_options: PollerOptions {
            frequency: Duration::seconds(1),
            ..Default::default()
        },
    });

    let mut poller = client
        .export("test-rg", "order1", export_request.clone(), options.clone())
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

    let poller = client
        .export("test-rg", "order1", export_request, options)
        .unwrap();
    let final_result = poller.await.unwrap().into_model().unwrap();
    assert_eq!(final_result.content, Some("order1,product1,1".to_string()));
}
