// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_madeoptional::{models::TestModel, MadeOptionalClient};

#[tokio::test]
async fn test() {
    let client = MadeOptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = TestModel {
        prop: Some("foo".to_string()),
        ..Default::default()
    };
    let resp = client
        .test(body.try_into().unwrap(), None)
        .await
        .unwrap()
        .into_model()
        .unwrap();
    assert_eq!(resp.prop, Some("foo".to_string()));
}
