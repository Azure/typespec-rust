// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_valuetypes::{
    models::{InnerModel, ModelProperty},
    ValueTypesClient,
};

#[tokio::test]
async fn get() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_value_types_model_client()
        .get(None)
        .await
        .unwrap()
        .into_body()
        .unwrap();
    assert!(resp.property.is_some());
    if let Some(model) = resp.property {
        assert_eq!(model.property, Some("hello".to_string()));
    }
}

#[tokio::test]
async fn put() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_value_types_model_client()
        .put(
            ModelProperty {
                property: Some(InnerModel {
                    property: Some("hello".to_string()),
                }),
            }
            .try_into()
            .unwrap(),
            None,
        )
        .await
        .unwrap();
}
