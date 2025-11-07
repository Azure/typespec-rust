// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_overload::{models::Resource, OverloadClient};

#[tokio::test]
async fn list() {
    let client = OverloadClient::with_no_credential("http://localhost:3000", None).unwrap();
    let response = client.list(None).await.unwrap();
    let resources: Vec<Resource> = response.into_model().unwrap();

    assert_eq!(resources.len(), 2);

    // Verify the first resource
    assert_eq!(resources[0].id, Some("1".to_string()));
    assert_eq!(resources[0].name, Some("foo".to_string()));
    assert_eq!(resources[0].scope, Some("car".to_string()));

    // Verify the second resource
    assert_eq!(resources[1].id, Some("2".to_string()));
    assert_eq!(resources[1].name, Some("bar".to_string()));
    assert_eq!(resources[1].scope, Some("bike".to_string()));
}

#[tokio::test]
async fn list_by_scope() {
    let client = OverloadClient::with_no_credential("http://localhost:3000", None).unwrap();
    let response = client.list_by_scope("car", None).await.unwrap();
    let resources: Vec<Resource> = response.into_model().unwrap();

    assert_eq!(resources.len(), 1);
    assert_eq!(resources[0].id, Some("1".to_string()));
    assert_eq!(resources[0].name, Some("foo".to_string()));
    assert_eq!(resources[0].scope, Some("car".to_string()));
}
