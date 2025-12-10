// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::http::StatusCode;
use spector_specialwords::{models::{DictMethods, SameAsModel}, SpecialWordsClient};

#[tokio::test]
async fn same_as_model() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let same_as_model = SameAsModel {
        same_as_model: Some(String::from("ok")),
    };
    let req = same_as_model.try_into().unwrap();
    let resp = client
        .get_special_words_model_properties_client()
        .same_as_model(req, None)
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::NoContent);
}

#[tokio::test]
async fn dict_methods() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let dict_methods = DictMethods {
        clear: Some(String::from("ok")),
        copy: Some(String::from("ok")),
        get: Some(String::from("ok")),
        items: Some(String::from("ok")),
        keys: Some(String::from("ok")),
        pop: Some(String::from("ok")),
        popitem: Some(String::from("ok")),
        setdefault: Some(String::from("ok")),
        update: Some(String::from("ok")),
        values: Some(String::from("ok")),
    };

    let req = dict_methods.try_into().unwrap();
    let resp = client
        .get_special_words_model_properties_client()
        .dict_methods(req, None)
        .await
        .unwrap();
    
    assert_eq!(resp.status(), StatusCode::NoContent);
}

