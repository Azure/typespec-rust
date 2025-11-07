// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_valuetypes::{models::NeverProperty, ValueTypesClient};

#[tokio::test]
async fn get() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_value_types_never_client()
        .get(None)
        .await
        .unwrap()
        .into_model()
        .unwrap();
    // The NeverProperty struct should have no properties
}

#[tokio::test]
async fn put() {
    let client = ValueTypesClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_value_types_never_client()
        .put(NeverProperty {}.try_into().unwrap(), None)
        .await
        .unwrap();
}
