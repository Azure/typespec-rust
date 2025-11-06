// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_optionality::{models::CollectionsByteProperty, OptionalClient};

#[tokio::test]
async fn get_all() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_optional_collections_byte_client()
        .get_all(None)
        .await
        .unwrap()
        .into_model()
        .unwrap();
    // According to mockapi.ts, the all endpoint returns
    // { property: ["aGVsbG8sIHdvcmxkIQ==", "aGVsbG8sIHdvcmxkIQ=="] }
    // which is base64 encoded "hello, world!" twice
    assert!(resp.property.is_some());
    if let Some(bytes_vec) = resp.property {
        assert_eq!(bytes_vec.len(), 2);
        for bytes in bytes_vec {
            assert_eq!(bytes, b"hello, world!".to_vec());
        }
    }
}

#[tokio::test]
async fn get_default() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_optional_collections_byte_client()
        .get_default(None)
        .await
        .unwrap()
        .into_model()
        .unwrap();
    // According to mockapi.ts, the default endpoint returns {}
    assert!(resp.property.is_none());
}

#[tokio::test]
async fn put_all() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    // Create a model with property set to a collection of bytes
    let model = CollectionsByteProperty {
        property: Some(vec![b"hello, world!".to_vec(), b"hello, world!".to_vec()]),
    };

    client
        .get_optional_collections_byte_client()
        .put_all(model.try_into().unwrap(), None)
        .await
        .unwrap();
    // The mockapi expects { property: ["aGVsbG8sIHdvcmxkIQ==", "aGVsbG8sIHdvcmxkIQ=="] }
}

#[tokio::test]
async fn put_default() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    // Create a default model with no properties set
    let model = CollectionsByteProperty::default();

    client
        .get_optional_collections_byte_client()
        .put_default(model.try_into().unwrap(), None)
        .await
        .unwrap();
    // The mockapi expects {}
}
