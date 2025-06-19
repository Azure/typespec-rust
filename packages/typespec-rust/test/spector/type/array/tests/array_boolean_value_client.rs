// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_array::ArrayClient;

#[tokio::test]
async fn get() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_array_boolean_value_client()
        .get(None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    let vec = resp.into_body().await.unwrap();
    assert_eq!(vec.len(), 2);
    assert_eq!(vec[0], true);
    assert_eq!(vec[1], false);
}

#[tokio::test]
async fn put() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_array_boolean_value_client()
        .put(r#"[true, false]"#.try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}
