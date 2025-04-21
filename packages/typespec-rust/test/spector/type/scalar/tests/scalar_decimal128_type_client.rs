// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use rust_decimal::{prelude::FromPrimitive, Decimal};
use spector_scalar::ScalarClient;

#[tokio::test]
async fn request_parameter() {
    let client = ScalarClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_scalar_decimal128_type_client()
        .request_parameter(Decimal::from_f32(0.33333).unwrap(), None)
        .await
        .unwrap();
}
