// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use serde_json::Value;
use spector_scalar::ScalarClient;

#[tokio::test]
async fn get() {
    let client = ScalarClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client.get_scalar_unknown_client().get(None).await.unwrap();

    assert_eq!(resp.status(), 200);
    assert_eq!(resp.into_body().unwrap(), Value::String("test".to_string()));
}

#[tokio::test]
async fn put() {
    let client = ScalarClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_scalar_unknown_client()
        .put(Value::String("test".to_string()).try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}
