// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use cadl_basicparams::{models::User, BasicClient};

#[async_std::test]
async fn simple() {
    let client = BasicClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut user = User::default();
    user.name = Some("foo".to_string());
    client
        .get_basic_explicit_body_client()
        .simple(user.try_into().unwrap(), None)
        .await
        .unwrap();
}
