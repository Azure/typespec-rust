// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::Etag;
use futures::StreamExt;
use spector_basic::{
    models::{BasicClientListOptions, PagedUser, User, UserList},
    BasicClient,
};

#[tokio::test]
async fn create_or_replace() {
    let client = BasicClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut resource = User {
        name: Some("Madge".to_string()),
        ..Default::default()
    };
    let resp = client
        .create_or_replace(1, resource.try_into().unwrap(), None)
        .await
        .unwrap();
    resource = resp.into_body().await.unwrap();
    assert_eq!(
        resource.etag,
        Some(Etag::from("11bdc430-65e8-45ad-81d9-8ffa60d55b59"))
    );
    assert_eq!(resource.id, Some(1));
    assert_eq!(resource.name, Some("Madge".to_string()));
}

#[tokio::test]
async fn create_or_update() {
    let client = BasicClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut resource = User {
        name: Some("Madge".to_string()),
        ..Default::default()
    };
    let resp = client
        .create_or_update(1, resource.try_into().unwrap(), None)
        .await
        .unwrap();
    resource = resp.into_body().await.unwrap();
    assert_eq!(
        resource.etag,
        Some(Etag::from("11bdc430-65e8-45ad-81d9-8ffa60d55b59"))
    );
    assert_eq!(resource.id, Some(1));
    assert_eq!(resource.name, Some("Madge".to_string()));
}

#[tokio::test]
async fn delete() {
    let client = BasicClient::with_no_credential("http://localhost:3000", None).unwrap();
    client.delete(1, None).await.unwrap();
}

#[tokio::test]
async fn export() {
    let client = BasicClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client.export(1, "json", None).await.unwrap();
    let user: User = resp.into_body().await.unwrap();
    assert_eq!(
        user.etag,
        Some(Etag::from("11bdc430-65e8-45ad-81d9-8ffa60d55b59"))
    );
    assert_eq!(user.id, Some(1));
    assert_eq!(user.name, Some("Madge".to_string()));
}

#[tokio::test]
async fn export_all_users() {
    let client = BasicClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client.export_all_users("json", None).await.unwrap();
    let user_list: UserList = resp.into_body().await.unwrap();
    let user_list = user_list.users.unwrap();
    assert_eq!(2, user_list.len());
    assert_eq!(
        user_list[0].etag,
        Some(Etag::from("11bdc430-65e8-45ad-81d9-8ffa60d55b59"))
    );
    assert_eq!(user_list[0].id, Some(1));
    assert_eq!(user_list[0].name, Some("Madge".to_string()));
    assert_eq!(
        user_list[1].etag,
        Some(Etag::from("22bdc430-65e8-45ad-81d9-8ffa60d55b59"))
    );
    assert_eq!(user_list[1].id, Some(2));
    assert_eq!(user_list[1].name, Some("John".to_string()));
}

#[tokio::test]
async fn get() {
    let client = BasicClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client.get(1, None).await.unwrap();
    let user: User = resp.into_body().await.unwrap();
    assert_eq!(
        user.etag,
        Some(Etag::from("11bdc430-65e8-45ad-81d9-8ffa60d55b59"))
    );
    assert_eq!(user.id, Some(1));
    assert_eq!(user.name, Some("Madge".to_string()));
}

#[tokio::test]
async fn list() {
    let client = BasicClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client
        .list(Some(BasicClientListOptions {
            expand: Some(vec!["orders".to_string()]),
            filter: Some("id lt 10".to_string()),
            orderby: Some(vec!["id".to_string()]),
            select: Some(vec![
                "id".to_string(),
                "orders".to_string(),
                "etag".to_string(),
            ]),
            skip: Some(10),
            top: Some(5),
            ..Default::default()
        }))
        .unwrap();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        let page = page.unwrap();
        page_count += 1;
        let paged_user: PagedUser = page.into_body().await.unwrap();
        let users = paged_user.value.unwrap();
        assert_eq!(users.len(), 2);
        assert_eq!(
            users[0].etag,
            Some(Etag::from("11bdc430-65e8-45ad-81d9-8ffa60d55b59"))
        );
        assert_eq!(users[0].id, Some(1));
        assert_eq!(users[0].name, Some("Madge".to_string()));
        if let Some(orders) = &users[0].orders {
            assert_eq!(orders.len(), 1);
            assert_eq!(orders[0].detail, Some("a recorder".to_string()));
            assert_eq!(orders[0].id, Some(1));
            assert_eq!(orders[0].user_id, Some(1));
        } else {
            panic!("missing orders for Madge");
        }
        assert_eq!(
            users[1].etag,
            Some(Etag::from("11bdc430-65e8-45ad-81d9-8ffa60d55b5a"))
        );
        assert_eq!(users[1].id, Some(2));
        assert_eq!(users[1].name, Some("John".to_string()));
        if let Some(orders) = &users[1].orders {
            assert_eq!(orders.len(), 1);
            assert_eq!(orders[0].detail, Some("a TV".to_string()));
            assert_eq!(orders[0].id, Some(2));
            assert_eq!(orders[0].user_id, Some(2));
        } else {
            panic!("missing orders for John");
        }
    }
    assert_eq!(page_count, 1);
}
