// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use std::collections::HashMap;

use spector_azurebasic::{
    models::{ActionRequest, ActionResponse, Model},
    BasicClient,
};

#[tokio::test]
async fn basic() {
    let client = BasicClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ActionRequest {
        array_property: Some(vec!["item".to_string()]),
        model_property: Some(Model {
            enum_property: Some(spector_azurebasic::models::Enum::EnumValue1),
            float32_property: Some(1.5),
            int32_property: Some(1),
        }),
        record_property: Some(HashMap::from([("record".to_string(), "value".to_string())])),
        string_property: Some("text".to_string()),
    };
    let resp = client
        .get_basic_service_operation_group_client()
        .basic(
            "query",
            "header".to_string(),
            body.try_into().unwrap(),
            None,
        )
        .await
        .unwrap();
    let action_resp: ActionResponse = resp.into_body().unwrap();
    assert_eq!(action_resp.string_property, Some("text".to_string()));
}
