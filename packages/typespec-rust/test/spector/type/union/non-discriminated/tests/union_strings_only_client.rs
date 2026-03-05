// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_union_nondiscriminated::models::{GetResponse, GetResponseProp};
use spector_union_nondiscriminated::UnionClient;

#[tokio::test]
async fn get() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_union_strings_only_client()
        .get(None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let value: GetResponse = resp.into_model().unwrap();
    assert_eq!(value.prop, Some(GetResponseProp::B));
}

#[tokio::test]
async fn send() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_union_strings_only_client()
        .send(GetResponseProp::B, None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}
