// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use cadl_specialwords::SpecialWordsClient;

#[async_std::test]
async fn with_and() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_and("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_as() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_as("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_assert() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_assert("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_async() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_async("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_await() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_await("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_break() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_break("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_cancellation_token() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_cancellation_token("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_class() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_class("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_constructor() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_constructor("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_continue() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_continue("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_def() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_def("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_del() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_del("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_elif() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_elif("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_else() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_else("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_except() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_except("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_exec() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_exec("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_finally() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_finally("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_for() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_for("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_from() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_from("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_global() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_global("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_if() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_if("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_import() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_import("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_in() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_in("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_is() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_is("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_lambda() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_lambda("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_not() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_not("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_or() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_or("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_pass() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_pass("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_raise() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_raise("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_return() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_return("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_try() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_try("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_while() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_while("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_with() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_with("ok".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn with_yield() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_parameters_client()
        .with_yield("ok".to_string(), None)
        .await
        .unwrap();
}
