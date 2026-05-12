// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_specialwords::SpecialWordsClient;

#[tokio::test]
async fn with_items() {
    let client = SpecialWordsClient::with_no_credential("http://localhost:3000", None).unwrap();
    let _resp = client
        .get_special_words_reserved_operation_body_params_client()
        .with_items(vec![String::from("item")], None)
        .await
        .unwrap();
}
