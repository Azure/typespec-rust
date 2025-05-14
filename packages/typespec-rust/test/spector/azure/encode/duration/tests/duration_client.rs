// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_azureduration::{models::DurationModel, DurationClient};

#[tokio::test]
async fn duration_constant() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = DurationModel {
        input: Some("1.02:59:59.5000000".to_string()),
    };
    client
        .duration_constant(body.try_into().unwrap(), None)
        .await
        .unwrap();
}
