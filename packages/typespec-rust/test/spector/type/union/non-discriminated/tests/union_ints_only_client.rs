// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_union_nondiscriminated::models::{GetResponse3, GetResponseProp2};
use spector_union_nondiscriminated::UnionClient;

#[tokio::test]
async fn get() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client.get_union_ints_only_client().get(None).await.unwrap();
    assert_eq!(resp.status(), 200);
    let value: GetResponse3 = resp.into_model().unwrap();
    assert_eq!(value.prop, Some(GetResponseProp2::INVLD_IDENTIFIER_2));
}

#[tokio::test]
async fn send() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_union_ints_only_client()
        .send(GetResponseProp2::INVLD_IDENTIFIER_2, None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}
