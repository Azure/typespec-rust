// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use std::collections::HashMap;

use cadl_azurebasic::{
    models::{ActionRequest, ActionResponse, Model},
    BasicClient,
};

#[async_std::test]
async fn basic() {
    let client = BasicClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut model_prop = Model::default();
    model_prop.enum_property = Some(cadl_azurebasic::models::Enum::EnumValue1);
    model_prop.float32_property = Some(1.5);
    model_prop.int32_property = Some(1);
    let mut body = ActionRequest::default();
    body.array_property = Some(vec!["item".to_string()]);
    body.model_property = Some(model_prop);
    body.record_property = Some(HashMap::from([("record".to_string(), "value".to_string())]));
    body.string_property = Some("text".to_string());
    let resp = client
        .get_basic_service_operation_group_client()
        .basic(
            "query".to_string(),
            "header".to_string(),
            body.try_into().unwrap(),
            None,
        )
        .await
        .unwrap();
    let action_resp: ActionResponse = resp.into_body().await.unwrap();
    assert_eq!(action_resp.string_property, Some("text".to_string()));
}
