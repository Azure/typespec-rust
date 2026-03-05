// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_union_nondiscriminated::models::{
    GetResponse7, StringAndArrayCases, StringAndArrayCasesArray, StringAndArrayCasesString,
};
use spector_union_nondiscriminated::UnionClient;

#[tokio::test]
async fn get() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_union_string_and_array_client()
        .get(None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let value: GetResponse7 = resp.into_model().unwrap();
    let prop = value.prop.unwrap();
    if let Some(StringAndArrayCasesArray::StringArray(arr)) = prop.array {
        assert_eq!(arr, vec!["test1".to_string(), "test2".to_string()]);
    } else {
        panic!("expected StringArray");
    }
    if let Some(StringAndArrayCasesString::String(s)) = prop.string {
        assert_eq!(s, "test");
    } else {
        panic!("expected String");
    }
}

#[tokio::test]
async fn send() {
    let client = UnionClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_union_string_and_array_client()
        .send(
            StringAndArrayCases {
                array: Some(StringAndArrayCasesArray::StringArray(vec![
                    "test1".to_string(),
                    "test2".to_string(),
                ])),
                string: Some(StringAndArrayCasesString::String("test".to_string())),
            },
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}
