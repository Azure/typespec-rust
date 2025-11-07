// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_optionality::{
    models::{CollectionsModelProperty, StringProperty},
    OptionalClient,
};

#[tokio::test]
async fn get_all() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_optional_collections_model_client()
        .get_all(None)
        .await
        .unwrap()
        .into_model()
        .unwrap();
    // According to mockapi.ts, the all endpoint returns
    // { property: [{ property: "hello" }, { property: "world" }] }

    assert!(resp.property.is_some());
    if let Some(models) = resp.property {
        assert_eq!(models.len(), 2);
        assert_eq!(models[0].property, Some("hello".to_string()));
        assert_eq!(models[1].property, Some("world".to_string()));
    }
}

#[tokio::test]
async fn get_default() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_optional_collections_model_client()
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
    // Create a model with property set to a collection of models
    let model = CollectionsModelProperty {
        property: Some(vec![
            StringProperty {
                property: Some("hello".to_string()),
            },
            StringProperty {
                property: Some("world".to_string()),
            },
        ]),
    };

    client
        .get_optional_collections_model_client()
        .put_all(model.try_into().unwrap(), None)
        .await
        .unwrap();
    // The mockapi expects { property: [{ property: "hello" }, { property: "world" }] }
}

#[tokio::test]
async fn put_default() {
    let client = OptionalClient::with_no_credential("http://localhost:3000", None).unwrap();
    // Create a default model with no properties set
    let model = CollectionsModelProperty::default();

    client
        .get_optional_collections_model_client()
        .put_default(model.try_into().unwrap(), None)
        .await
        .unwrap();
    // The mockapi expects {}
}
