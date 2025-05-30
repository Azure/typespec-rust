// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_bodyoptional::{
    models::{BodyModel, BodyOptionalityOptionalExplicitClientSetOptions},
    BodyOptionalityClient,
};

#[tokio::test]
async fn set() {
    let client = BodyOptionalityClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body_model = BodyModel {
        name: Some("foo".to_string()),
    };

    let mut options: BodyOptionalityOptionalExplicitClientSetOptions = Default::default();
    options.body = Some(body_model.try_into().unwrap());

    client
        .get_body_optionality_optional_explicit_client()
        .set(Some(options))
        .await
        .unwrap();
}

#[tokio::test]
async fn omit() {
    let client = BodyOptionalityClient::with_no_credential("http://localhost:3000", None).unwrap();

    // Send request with no body
    client
        .get_body_optionality_optional_explicit_client()
        .omit(None)
        .await
        .unwrap();
}
