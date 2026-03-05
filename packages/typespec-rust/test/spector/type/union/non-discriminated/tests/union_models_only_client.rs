// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_union_nondiscriminated::models::{Cat, GetResponse5, GetResponseProp4};
use spector_union_nondiscriminated::UnionClient;

#[tokio::test]
async fn get() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_union_models_only_client()
        .get(None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let value: GetResponse5 = resp.into_model().unwrap();
    if let Some(GetResponseProp4::Cat(cat)) = value.prop {
        assert_eq!(cat.name.as_deref(), Some("test"));
    } else {
        panic!("expected Cat variant");
    }
}

#[tokio::test]
async fn send() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_union_models_only_client()
        .send(
            GetResponseProp4::Cat(Cat {
                name: Some("test".to_string()),
            }),
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}
