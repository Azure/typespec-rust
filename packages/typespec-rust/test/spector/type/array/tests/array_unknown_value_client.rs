// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use serde_json::Value;
use spector_array::ArrayClient;

#[tokio::test]
async fn get() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_array_unknown_value_client()
        .get(None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    let vec = resp.into_body().await.unwrap();
    assert_eq!(vec.len(), 3);
    assert_eq!(vec[0], Value::Number(1.into()));
    assert_eq!(vec[1], Value::String("hello".to_string()));
    assert_eq!(vec[2], Value::Null);
}

// This test is ignored because it uses #r syntax which technically allows user to pass the value, but this is
// not the experience we want users to have. Once we enable better syntax, we whould update it and then enable.
#[ignore]
#[tokio::test]
async fn put() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_array_unknown_value_client()
        .put(r#"[1, "hello", null]"#.try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}
