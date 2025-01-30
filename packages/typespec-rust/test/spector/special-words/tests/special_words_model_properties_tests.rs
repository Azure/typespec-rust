// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_specialwords::{models::SameAsModel, SpecialWordsClient};

#[tokio::test]
async fn same_as_model() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let same_as_model = SameAsModel {
        same_as_model: Some(String::from("ok")),
    };
    let req = same_as_model.try_into().unwrap();
    let _resp = client
        .get_special_words_model_properties_client()
        .same_as_model(req, None)
        .await
        .unwrap();
}
