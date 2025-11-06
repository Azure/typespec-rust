// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_scalar::ScalarClient;

#[tokio::test]
async fn get() {
    let client = ScalarClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client.get_scalar_string_client().get(None).await.unwrap();

    assert_eq!(resp.status(), 200);
    assert_eq!(resp.into_model().unwrap(), "test");
}

// This test is ignored because it uses #r syntax which technically allows user to pass the value, but this is
// not the experience we want users to have. Once we enable better syntax, we whould update it and then enable.
#[tokio::test]
#[ignore]
async fn put() {
    let client = ScalarClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_scalar_string_client()
        .put(r#""test""#.try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}
