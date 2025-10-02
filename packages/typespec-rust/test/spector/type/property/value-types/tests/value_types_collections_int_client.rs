// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_valuetypes::{models::CollectionsIntProperty, ValueTypesClient};

#[tokio::test]
async fn get() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_value_types_collections_int_client()
        .get(None)
        .await
        .unwrap()
        .into_body()
        .unwrap();
    assert!(resp.property.is_some());
    if let Some(collection) = resp.property {
        assert_eq!(collection, vec![1, 2]);
    }
}

#[tokio::test]
async fn put() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_value_types_collections_int_client()
        .put(
            CollectionsIntProperty {
                property: Some(vec![1, 2]),
            }
            .try_into()
            .unwrap(),
            None,
        )
        .await
        .unwrap();
}
