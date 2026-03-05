// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_union_nondiscriminated::models::{
    GetResponse8, MixedLiteralsCases, MixedLiteralsCasesStringLiteral,
};
use spector_union_nondiscriminated::UnionClient;

#[tokio::test]
async fn get() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_union_mixed_literals_client()
        .get(None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let value: GetResponse8 = resp.into_model().unwrap();
    let prop = value.prop.unwrap();
    if let Some(MixedLiteralsCasesStringLiteral::Boolean(b)) = prop.boolean_literal {
        assert!(b);
    } else {
        panic!("expected Boolean");
    }
    if let Some(MixedLiteralsCasesStringLiteral::Float32(f)) = prop.float_literal {
        assert!((f - 3.3_f32).abs() < 0.001);
    } else {
        panic!("expected Float32");
    }
    if let Some(MixedLiteralsCasesStringLiteral::Int32(n)) = prop.int_literal {
        assert_eq!(n, 2);
    } else {
        panic!("expected Int32");
    }
    if let Some(MixedLiteralsCasesStringLiteral::String(s)) = prop.string_literal {
        assert_eq!(s, "a");
    } else {
        panic!("expected String");
    }
}

#[tokio::test]
async fn send() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_union_mixed_literals_client()
        .send(
            MixedLiteralsCases {
                boolean_literal: Some(MixedLiteralsCasesStringLiteral::Boolean(true)),
                float_literal: Some(MixedLiteralsCasesStringLiteral::Float32(3.3)),
                int_literal: Some(MixedLiteralsCasesStringLiteral::Int32(2)),
                string_literal: Some(MixedLiteralsCasesStringLiteral::String("a".to_string())),
            },
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}
