// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_valuetypes::{
    models::{CollectionsModelProperty, InnerModel},
    ValueTypesClient,
};

#[tokio::test]
async fn get() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_value_types_collections_model_client()
        .get(None)
        .await
        .unwrap()
        .into_body()
        .await
        .unwrap();
    assert!(resp.property.is_some());
    if let Some(collection) = resp.property {
        assert_eq!(collection.len(), 2);
        assert_eq!(collection[0].property, Some("hello".to_string()));
        assert_eq!(collection[1].property, Some("world".to_string()));
    }
}

#[tokio::test]
async fn put() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let models = vec![
        InnerModel {
            property: Some("hello".to_string()),
        },
        InnerModel {
            property: Some("world".to_string()),
        },
    ];

    client
        .get_value_types_collections_model_client()
        .put(
            CollectionsModelProperty {
                property: Some(models),
            }
            .try_into()
            .unwrap(),
            None,
        )
        .await
        .unwrap();
}
