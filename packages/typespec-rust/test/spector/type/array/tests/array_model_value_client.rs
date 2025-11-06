// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_array::ArrayClient;

#[tokio::test]
async fn get() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_array_model_value_client()
        .get(None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    let vec = resp.into_model().unwrap();
    assert_eq!(vec.len(), 2);
    assert_eq!(vec[0].property, Some("hello".to_string()));
    assert!(vec[0].children.is_none());
    assert_eq!(vec[1].property, Some("world".to_string()));
    assert!(vec[1].children.is_none());
}

// This test is ignored because it uses #r syntax which technically allows user to pass the value, but this is
// not the experience we want users to have. Once we enable better syntax, we whould update it and then enable.
#[tokio::test]
#[ignore]
async fn put() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_array_model_value_client()
        .put(
            r#"[{"property": "hello"}, {"property": "world"}]"#.try_into().unwrap(),
            None,
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}
