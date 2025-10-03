// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use rust_decimal::{prelude::FromPrimitive, Decimal};
use spector_scalar::ScalarClient;

#[tokio::test]
async fn prepare_verify() {
    let client = ScalarClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_scalar_decimal128_verify_client()
        .prepare_verify(None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    let vec = resp.into_body().unwrap();
    assert_eq!(vec.len(), 3);
    assert_eq!(vec[0], Decimal::from_f32(0.1).unwrap());
    assert_eq!(vec[1], Decimal::from_f32(0.1).unwrap());
    assert_eq!(vec[2], Decimal::from_f32(0.1).unwrap());
}

#[tokio::test]
async fn verify() {
    let client = ScalarClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_scalar_decimal128_verify_client()
        .verify(Decimal::from_f32(0.3).try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}
