// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_union_nondiscriminated::models::{
    EnumsOnlyCases, EnumsOnlyCasesLr, EnumsOnlyCasesUd, GetResponse6,
};
use spector_union_nondiscriminated::UnionClient;

#[tokio::test]
async fn get() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_union_enums_only_client()
        .get(None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let value: GetResponse6 = resp.into_model().unwrap();
    let prop = value.prop.unwrap();
    assert_eq!(prop.lr, Some(EnumsOnlyCasesLr::Right));
    assert_eq!(prop.ud, Some(EnumsOnlyCasesUd::Up));
}

#[tokio::test]
async fn send() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_union_enums_only_client()
        .send(
            EnumsOnlyCases {
                lr: Some(EnumsOnlyCasesLr::Right),
                ud: Some(EnumsOnlyCasesUd::Up),
            },
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}
