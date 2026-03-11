// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_specialwords::{extensible_strings::models::ExtensibleString, SpecialWordsClient};

#[tokio::test]
async fn put_extensible_string_value_and() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::And;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_as() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::As;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_assert() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Assert;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_async() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Async;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_await() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Await;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_break() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Break;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_class() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Class;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_constructor() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Constructor;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_continue() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Continue;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_def() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Def;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_del() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Del;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_elif() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Elif;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_else() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Else;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_except() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Except;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_exec() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Exec;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_finally() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Finally;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_for() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::For;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_from() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::From;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_global() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Global;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_if() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::If;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_import() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Import;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_in() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::In;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_is() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Is;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_lambda() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Lambda;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_not() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Not;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_or() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Or;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_pass() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Pass;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_raise() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Raise;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_return() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Return;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_try() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Try;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_while() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::While;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_with() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::With;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn put_extensible_string_value_yield() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ExtensibleString::Yield;
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_extensible_strings_client()
        .put_extensible_string_value(req, None)
        .await
        .unwrap();
}
