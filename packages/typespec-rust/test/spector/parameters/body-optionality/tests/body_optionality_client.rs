// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_bodyoptional::{models::BodyModel, BodyOptionalityClient};

#[tokio::test]
async fn required_explicit() {
    let client = BodyOptionalityClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body_model = BodyModel {
        name: Some("foo".to_string()),
    };

    client
        .required_explicit(body_model.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn required_implicit() {
    let client = BodyOptionalityClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .required_implicit("foo".to_string(), None)
        .await
        .unwrap();
}
