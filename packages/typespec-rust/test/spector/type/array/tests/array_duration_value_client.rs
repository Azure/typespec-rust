// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_array::ArrayClient;

// This test is ignored because it does not use the syntax to veryfy the value received.
// Once users can read durations they receive, the tests should be updated and enabled.
#[tokio::test]
#[ignore]
async fn get() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_array_duration_value_client()
        .get(None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    let vec = resp.into_body().await.unwrap();
    assert_eq!(vec.len(), 1);
}

// This test is ignored because it uses #r syntax which technically allows user to pass the value, but this is
// not the experience we want users to have. Once we enable better syntax, we whould update it and then enable.
#[tokio::test]
#[ignore]
async fn put() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_array_duration_value_client()
        .put(r#"["P123DT22H14M12.011S"]"#.try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}
