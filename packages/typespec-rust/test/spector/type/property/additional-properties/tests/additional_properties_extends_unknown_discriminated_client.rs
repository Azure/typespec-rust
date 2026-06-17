// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use serde_json::Value;
use spector_addlprops::{
    models::{
        ExtendsUnknownAdditionalPropertiesDiscriminated,
        ExtendsUnknownAdditionalPropertiesDiscriminatedDerived,
    },
    AdditionalPropertiesClient,
};
use std::collections::HashMap;

fn derived() -> ExtendsUnknownAdditionalPropertiesDiscriminatedDerived {
    let mut additional = HashMap::new();
    additional.insert("prop1".to_string(), Value::Number(32.into()));
    additional.insert("prop2".to_string(), Value::Bool(true));
    additional.insert("prop3".to_string(), Value::String("abc".to_string()));
    ExtendsUnknownAdditionalPropertiesDiscriminatedDerived {
        name: Some("Derived".to_string()),
        index: Some(314),
        age: Some(2.71875),
        additional_properties: Some(additional),
    }
}

#[tokio::test]
async fn get() {
    let client =
        AdditionalPropertiesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_additional_properties_extends_unknown_discriminated_client()
        .get(None)
        .await
        .unwrap()
        .into_model()
        .unwrap();
    match resp {
        ExtendsUnknownAdditionalPropertiesDiscriminated::ExtendsUnknownAdditionalPropertiesDiscriminatedDerived(d) => {
            assert_eq!(d.name.as_deref(), Some("Derived"));
            assert_eq!(d.index, Some(314));
            assert_eq!(d.age, Some(2.71875));
            let additional = d.additional_properties.unwrap();
            assert_eq!(additional.get("prop1"), Some(&Value::Number(32.into())));
            assert_eq!(additional.get("prop2"), Some(&Value::Bool(true)));
            assert_eq!(additional.get("prop3"), Some(&Value::String("abc".to_string())));
        }
        other => panic!("unexpected variant: {other:?}"),
    }
}

#[tokio::test]
async fn put() {
    let client =
        AdditionalPropertiesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body: ExtendsUnknownAdditionalPropertiesDiscriminated = derived().into();
    client
        .get_additional_properties_extends_unknown_discriminated_client()
        .put(body.try_into().unwrap(), None)
        .await
        .unwrap();
}
