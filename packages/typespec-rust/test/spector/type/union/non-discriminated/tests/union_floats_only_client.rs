// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_union_nondiscriminated::models::{GetResponse4, GetResponseProp3};
use spector_union_nondiscriminated::UnionClient;

#[tokio::test]
async fn get() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_union_floats_only_client()
        .get(None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let value: GetResponse4 = resp.into_model().unwrap();
    assert_eq!(value.prop, Some(GetResponseProp3::INVLD_IDENTIFIER_2_2));
}

#[tokio::test]
async fn send() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_union_floats_only_client()
        .send(GetResponseProp3::INVLD_IDENTIFIER_2_2, None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}
