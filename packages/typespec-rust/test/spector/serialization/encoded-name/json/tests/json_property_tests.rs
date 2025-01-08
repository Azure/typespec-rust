// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_jsonencodedname::{models::JsonEncodedNameModel, JsonClient};

#[async_std::test]
async fn get() {
    let client = JsonClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client.get_json_property_client().get(None).await.unwrap();
    let value: JsonEncodedNameModel = resp.into_body().await.unwrap();
    assert_eq!(value.default_name, Some(true));
}

#[async_std::test]
async fn send() {
    let client = JsonClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut model = JsonEncodedNameModel::default();
    model.default_name = Some(true);
    let req = model.try_into().unwrap();
    let _resp = client
        .get_json_property_client()
        .send(req, None)
        .await
        .unwrap();
}
