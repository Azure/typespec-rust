// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use rust_decimal::{prelude::FromPrimitive, Decimal};
use spector_scalar::ScalarClient;

#[tokio::test]
async fn request_parameter() {
    let client = ScalarClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_scalar_decimal128_type_client()
        .request_parameter(Decimal::from_f32(0.33333).unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn request_body() {
    let client = ScalarClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_scalar_decimal128_type_client()
        .request_body(r#"0.33333"#.try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn response_body() {
    let client = ScalarClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_scalar_decimal128_type_client()
        .response_body(None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
    assert_eq!(
        resp.into_body().await.unwrap(),
        Decimal::from_f32(0.33333).unwrap()
    );
}
