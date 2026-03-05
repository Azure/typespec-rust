// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_union_nondiscriminated::models::{
    Cat, GetResponse9, MixedTypesCases, MixedTypesCasesModel,
};
use spector_union_nondiscriminated::UnionClient;

#[tokio::test]
async fn get() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_union_mixed_types_client()
        .get(None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let value: GetResponse9 = resp.into_model().unwrap();
    let MixedTypesCases {
        array,
        boolean,
        int,
        literal,
        model,
    } = value.prop.unwrap();
    if let Some(MixedTypesCasesModel::Cat(cat)) = model {
        assert_eq!(cat.name.as_deref(), Some("test"));
    } else {
        panic!("expected Cat");
    }
    if let Some(MixedTypesCasesModel::String(s)) = literal {
        assert_eq!(s, "a");
    } else {
        panic!("expected String");
    }
    if let Some(MixedTypesCasesModel::Int32(n)) = int {
        assert_eq!(n, 2);
    } else {
        panic!("expected Int32");
    }
    if let Some(MixedTypesCasesModel::Boolean(b)) = boolean {
        assert!(b);
    } else {
        panic!("expected Boolean");
    }
    let arr = array.unwrap();
    assert_eq!(arr.len(), 4);
    if let MixedTypesCasesModel::Cat(cat) = &arr[0] {
        assert_eq!(cat.name.as_deref(), Some("test"));
    } else {
        panic!("expected Cat at [0]");
    }
    if let MixedTypesCasesModel::String(s) = &arr[1] {
        assert_eq!(s, "a");
    } else {
        panic!("expected String at [1]");
    }
    if let MixedTypesCasesModel::Int32(n) = &arr[2] {
        assert_eq!(*n, 2);
    } else {
        panic!("expected Int32 at [2]");
    }
    if let MixedTypesCasesModel::Boolean(b) = &arr[3] {
        assert!(*b);
    } else {
        panic!("expected Boolean at [3]");
    }
}

#[tokio::test]
async fn send() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_union_mixed_types_client()
        .send(
            MixedTypesCases {
                array: Some(vec![
                    MixedTypesCasesModel::Cat(Cat {
                        name: Some("test".to_string()),
                    }),
                    MixedTypesCasesModel::String("a".to_string()),
                    MixedTypesCasesModel::Int32(2),
                    MixedTypesCasesModel::Boolean(true),
                ]),
                boolean: Some(MixedTypesCasesModel::Boolean(true)),
                int: Some(MixedTypesCasesModel::Int32(2)),
                literal: Some(MixedTypesCasesModel::String("a".to_string())),
                model: Some(MixedTypesCasesModel::Cat(Cat {
                    name: Some("test".to_string()),
                })),
            },
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}
