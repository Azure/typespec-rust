// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_xml::{
    models::{Book, ModelWithRenamedWrappedAndItemModelArray},
    XmlClient,
};

#[tokio::test]
async fn get() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_xml_model_with_renamed_wrapped_and_item_model_array_value_client()
        .get(None)
        .await
        .unwrap();
    let value: ModelWithRenamedWrappedAndItemModelArray = resp.into_model().unwrap();
    let books = value.books.unwrap();
    assert_eq!(books.len(), 2);
    assert_eq!(books[0].title, Some("The Great Gatsby".to_string()));
    assert_eq!(books[1].title, Some("Les Miserables".to_string()));
}

#[tokio::test]
async fn put() {
    let client = XmlClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = ModelWithRenamedWrappedAndItemModelArray {
        books: Some(vec![
            Book {
                title: Some("The Great Gatsby".to_string()),
            },
            Book {
                title: Some("Les Miserables".to_string()),
            },
        ]),
    };
    client
        .get_xml_model_with_renamed_wrapped_and_item_model_array_value_client()
        .put(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
