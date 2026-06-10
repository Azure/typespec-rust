// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::http::RequestContent;
use spector_coreusage::{
    models::{nested::NestedNamespaceModel, NamespaceModel},
    UsageClient,
};

#[tokio::test]
async fn namespace_model_serializable() {
    let client = UsageClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = NamespaceModel {
        name: Some("test".to_string()),
    };
    let json = serde_json::to_string(&body).unwrap();
    client
        .get_usage_namespace_usage_client()
        .namespace_model_serializable(RequestContent::from_str(&json), None)
        .await
        .unwrap();
}

/// Verifies that `NestedNamespaceModel` is reachable through the public
/// `models::nested` surface and round-trips through serde.
#[test]
fn nested_namespace_model_is_reachable() {
    let model = NestedNamespaceModel {
        value: Some("nested-value".to_string()),
    };
    let json = serde_json::to_string(&model).unwrap();
    assert_eq!(json, r#"{"value":"nested-value"}"#);

    let parsed: NestedNamespaceModel = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed.value.as_deref(), Some("nested-value"));
}
