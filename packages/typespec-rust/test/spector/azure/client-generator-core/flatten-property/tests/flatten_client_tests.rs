// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_flattenproperty::models::{
    ChildFlattenModel, ChildModel, FlattenModel, NestedFlattenModel,
};
use spector_flattenproperty::FlattenPropertyClient;

#[tokio::test]
async fn put_flatten_model() {
    let client = FlattenPropertyClient::with_no_credential("http://localhost:3000", None).unwrap();
    let flatten_model = FlattenModel {
        name: Some(String::from("foo")),
        properties: Some(ChildModel {
            age: Some(10),
            description: Some(String::from("bar")),
        }),
    };
    let req = flatten_model.try_into().unwrap();
    let resp = client.put_flatten_model(req, None).await.unwrap();
    let value: FlattenModel = resp.into_model().unwrap();
    assert_eq!(value.name, Some(String::from("test")));
    let props = value.properties.unwrap();
    assert_eq!(props.age, Some(1));
    assert_eq!(props.description, Some(String::from("test")));
}

#[tokio::test]
async fn put_nested_flatten_model() {
    let client = FlattenPropertyClient::with_no_credential("http://localhost:3000", None).unwrap();
    let nested_flatten_model = NestedFlattenModel {
        name: Some("foo".to_string()),
        properties: Some(ChildFlattenModel {
            properties: Some(ChildModel {
                age: Some(10),
                description: Some("test".to_string()),
            }),
            summary: Some("bar".to_string()),
        }),
    };
    let req = nested_flatten_model.try_into().unwrap();
    let resp = client.put_nested_flatten_model(req, None).await.unwrap();
    let value: NestedFlattenModel = resp.into_model().unwrap();
    assert_eq!(value.name, Some(String::from("test")));
    let props = value.properties.unwrap();
    assert_eq!(props.summary, Some(String::from("test")));
    let props = props.properties.unwrap();
    assert_eq!(props.age, Some(1));
    assert_eq!(props.description, Some(String::from("foo")));
}
