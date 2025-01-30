// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_specialwords::SpecialWordsClient;

use spector_specialwords::models::{
    And, As, Assert, Async, Await, Break, Class, Constructor, Continue, Def, Del, Elif, Else,
    Except, Exec, Finally, For, From, Global, If, Import, In, Is, Lambda, Not, Or, Pass, Raise,
    Return, Try, While, With, Yield,
};

#[tokio::test]
async fn with_and() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = And {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_and(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_as() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = As {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_as(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_assert() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Assert {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_assert(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_async() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Async {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_async(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_await() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Await {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_await(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_break() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Break {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_break(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_class() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Class {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_class(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_constructor() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Constructor {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_constructor(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_continue() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Continue {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_continue(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_def() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Def {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_def(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_del() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Del {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_del(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_elif() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Elif {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_elif(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_else() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Else {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_else(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_except() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Except {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_except(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_exec() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Exec {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_exec(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_finally() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Finally {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_finally(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_for() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = For {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_for(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_from() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = From {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_from(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_global() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Global {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_global(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_if() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = If {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_if(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_import() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Import {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_import(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_in() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = In {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_in(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_is() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Is {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_is(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_lambda() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Lambda {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_lambda(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_not() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Not {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_not(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_or() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Or {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_or(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_pass() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Pass {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_pass(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_raise() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Raise {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_raise(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_return() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Return {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_return(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_try() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Try {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_try(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_while() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = While {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_while(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_with() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = With {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_with(req, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn with_yield() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Yield {
        name: Some(String::from("ok")),
    };
    let req = body.try_into().unwrap();
    let _resp = client
        .get_special_words_models_client()
        .with_yield(req, None)
        .await
        .unwrap();
}
