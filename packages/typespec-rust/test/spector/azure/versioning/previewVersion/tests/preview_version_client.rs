// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_azpreviewversion::{
    models::{PreviewVersionClientListWidgetsOptions, UpdateWidgetColorRequest},
    PreviewVersionClient, PreviewVersionClientOptions,
};

#[tokio::test]
async fn get_widget() {
    let client = PreviewVersionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client.get_widget("widget-123", None).await.unwrap();
    let resp = resp.into_model().unwrap();
    assert_eq!(resp.color, Some("blue".to_string()));
    assert_eq!(resp.id, Some("widget-123".to_string()));
    assert_eq!(resp.name, Some("Sample Widget".to_string()));
}

#[tokio::test]
async fn list_widgets() {
    let client = PreviewVersionClient::with_no_credential(
        "http://localhost:3000",
        Some(PreviewVersionClientOptions {
            api_version: "2024-06-01".to_string(),
            ..Default::default()
        }),
    )
    .unwrap();
    let resp = client
        .list_widgets(Some(PreviewVersionClientListWidgetsOptions {
            name: Some("test".to_string()),
            ..Default::default()
        }))
        .await
        .unwrap();
    let resp = resp.into_model().unwrap();
    let widgets = resp.widgets.unwrap();
    assert_eq!(widgets[0].color, None);
    assert_eq!(widgets[0].id, Some("widget-1".to_string()));
    assert_eq!(widgets[0].name, Some("test".to_string()));
}

#[tokio::test]
async fn update_widget_color() {
    let client = PreviewVersionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let color_update = UpdateWidgetColorRequest {
        color: Some("red".to_string()),
    };
    let resp = client
        .update_widget_color("widget-123", color_update.try_into().unwrap(), None)
        .await
        .unwrap();
    let resp = resp.into_model().unwrap();
    assert_eq!(resp.color, Some("red".to_string()));
    assert_eq!(resp.id, Some("widget-123".to_string()));
    assert_eq!(resp.name, Some("Sample Widget".to_string()));
}
