// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_basicparams::{explicit_body::models::User, BasicClient};

#[tokio::test]
async fn simple() {
    let client = BasicClient::with_no_credential("http://localhost:3000", None).unwrap();
    let user = User {
        name: Some("foo".to_string()),
    };
    client
        .get_basic_explicit_body_client()
        .simple(user.try_into().unwrap(), None)
        .await
        .unwrap();
}
