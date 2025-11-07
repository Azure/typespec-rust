// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_clientloc::{models::Blob, ClientLocationClient};

#[tokio::test]
async fn test_get_health_status() {
    let client = ClientLocationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.get_health_status(None).await.unwrap();
}

#[tokio::test]
async fn test_archive_product() {
    let client = ClientLocationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let archive_client = client.get_client_location_archive_operations_client();
    archive_client.archive_product(None).await.unwrap();
}

#[tokio::test]
async fn test_get_resource() {
    let client = ClientLocationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let root_client = client.get_client_location_move_to_root_client();
    let resource_client = root_client.get_client_location_move_to_root_resource_operations_client();
    resource_client.get_resource(None).await.unwrap();
}

#[tokio::test]
async fn test_list_products() {
    let client = ClientLocationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let new_sub_client = client.get_client_location_move_to_new_sub_client();
    let product_client =
        new_sub_client.get_client_location_move_to_new_sub_product_operations_client();
    product_client.list_products(None).await.unwrap();
}

#[tokio::test]
async fn test_get_user() {
    let client = ClientLocationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let existing_sub_client = client.get_client_location_move_to_existing_sub_client();
    let user_client =
        existing_sub_client.get_client_location_move_to_existing_sub_user_operations_client();
    user_client.get_user(None).await.unwrap();
}

#[tokio::test]
async fn test_delete_user() {
    let client = ClientLocationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let existing_sub_client = client.get_client_location_move_to_existing_sub_client();
    let admin_client =
        existing_sub_client.get_client_location_move_to_existing_sub_admin_operations_client();
    admin_client.delete_user(None).await.unwrap();
}

#[tokio::test]
async fn test_get_admin_info() {
    let client = ClientLocationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let existing_sub_client = client.get_client_location_move_to_existing_sub_client();
    let admin_client =
        existing_sub_client.get_client_location_move_to_existing_sub_admin_operations_client();
    admin_client.get_admin_info(None).await.unwrap();
}

#[tokio::test]
async fn test_get_blob() {
    let client = ClientLocationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let parameter_client =
        client.get_client_location_move_method_parameter_to_client("testaccount".to_string());
    let blob_client =
        parameter_client.get_client_location_move_method_parameter_to_blob_operations_client();
    let result = blob_client
        .get_blob("testcontainer", "testblob.txt", None)
        .await
        .unwrap();
    let blob: Blob = result.into_model().unwrap();
    assert_eq!(blob.id, Some("blob-001".to_string()));
    assert_eq!(blob.name, Some("testblob.txt".to_string()));
    assert_eq!(blob.size, Some(1024));
    assert_eq!(blob.path, Some("/testcontainer/testblob.txt".to_string()));
}
