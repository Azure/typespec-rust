// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_recursive::{models::Extension, RecursiveClient};

#[tokio::test]
async fn client_rejects_malformed_url() {
    let result = RecursiveClient::with_no_credential("not-a-valid-url", None);
    assert!(result.is_err(), "malformed URL should be rejected");
}

#[tokio::test]
async fn client_rejects_non_http_scheme() {
    let result = RecursiveClient::with_no_credential("ftp://localhost:3000", None);
    assert!(result.is_err(), "non-http scheme should be rejected");
}

// Test: verify model with empty extensions list.
#[tokio::test]
async fn extension_model_with_empty_children() {
    let model = Extension {
        level: Some(0),
        extension: Some(vec![]),
    };
    assert_eq!(model.level, Some(0));
    assert_eq!(model.extension.as_ref().unwrap().len(), 0);
}

// Test: verify model with no extensions can be constructed.
#[tokio::test]
async fn extension_model_with_no_children() {
    let model = Extension {
        level: Some(5),
        extension: None,
    };
    assert_eq!(model.level, Some(5));
    assert!(model.extension.is_none());
}

#[tokio::test]
async fn get_returns_200_with_recursive_model() {
    let client = RecursiveClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client.get(None).await.unwrap();
    assert_eq!(resp.status(), 200, "get should return 200 OK");
    let model: Extension = resp.into_model().unwrap();
    // Verify the top-level model has expected fields.
    assert!(model.level.is_some(), "level should be present");
    assert_eq!(model.level, Some(0));
    // Verify nested extensions exist.
    assert!(model.extension.is_some(), "extension should be present");
    let extensions = model.extension.unwrap();
    assert!(!extensions.is_empty(), "extension list should not be empty");
    // Verify first nested extension.
    assert_eq!(extensions[0].level, Some(1));
    assert!(
        extensions[0].extension.is_some(),
        "nested extension should be present"
    );
    let nested = extensions[0].extension.as_ref().unwrap();
    assert_eq!(nested[0].level, Some(2));
}

// Test: verify a deeply-nested recursive structure can be sent.
#[tokio::test]
async fn put_deeply_nested_structure() {
    let client = RecursiveClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = Extension {
        level: Some(0),
        extension: Some(vec![
            Extension {
                level: Some(1),
                extension: Some(vec![Extension {
                    level: Some(2),
                    extension: None,
                }]),
            },
            Extension {
                level: Some(1),
                extension: None,
            },
        ]),
    };
    // This validates the serialization of deeply nested recursive types.
    client.put(input.try_into().unwrap(), None).await.unwrap();
}

#[tokio::test]
async fn put_returns_204() {
    let client = RecursiveClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = Extension {
        level: Some(0),
        extension: Some(vec![
            Extension {
                level: Some(1),
                extension: Some(vec![Extension {
                    level: Some(2),
                    extension: None,
                }]),
            },
            Extension {
                level: Some(1),
                extension: None,
            },
        ]),
    };
    let resp = client.put(input.try_into().unwrap(), None).await.unwrap();
    assert_eq!(resp.status(), 204, "put should return 204 No Content");
}
