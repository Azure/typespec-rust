// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_nodisc::{models::Siamese, NotDiscriminatedClient};

#[tokio::test]
async fn get_valid() {
    let client = NotDiscriminatedClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_valid(None)
        .await
        .unwrap()
        .into_body()
        .await
        .unwrap();
    assert_eq!(resp.age, Some(32));
    assert_eq!(resp.name, Some("abc".to_string()));
    assert_eq!(resp.smart, Some(true));
}

#[tokio::test]
async fn post_valid() {
    let client = NotDiscriminatedClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Siamese {
        age: Some(32),
        name: Some("abc".to_string()),
        smart: Some(true),
    };
    client
        .post_valid(body.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_valid() {
    let client = NotDiscriminatedClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Siamese {
        age: Some(32),
        name: Some("abc".to_string()),
        smart: Some(true),
    };
    let resp = client
        .put_valid(body.try_into().unwrap(), None)
        .await
        .unwrap()
        .into_body()
        .await
        .unwrap();
    assert_eq!(resp.age, Some(32));
    assert_eq!(resp.name, Some("abc".to_string()));
    assert_eq!(resp.smart, Some(true));
}
