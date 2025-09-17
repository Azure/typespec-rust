// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use futures::StreamExt;
use spector_corepageable::{models::LinkResponse, PageableClient};

#[tokio::test]
async fn list() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut iter = client
        .get_pageable_server_driven_pagination_client()
        .list(None)
        .unwrap();
    let mut item_count = 0;
    while let Some(item) = iter.next().await {
        item_count += 1;
        let item = item.unwrap();
        match item_count {
            1 => {
                assert_eq!(item.id, Some("1".to_string()));
                assert_eq!(item.name, Some("dog".to_string()));
            }
            2 => {
                assert_eq!(item.id, Some("2".to_string()));
                assert_eq!(item.name, Some("cat".to_string()));
            }
            3 => {
                assert_eq!(item.id, Some("3".to_string()));
                assert_eq!(item.name, Some("bird".to_string()));
            }
            4 => {
                assert_eq!(item.id, Some("4".to_string()));
                assert_eq!(item.name, Some("fish".to_string()));
            }
            _ => panic!("unexpected page number"),
        }
    }
    assert_eq!(item_count, 4);
}

#[tokio::test]
async fn list_pages() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client
        .get_pageable_server_driven_pagination_client()
        .list(None)
        .unwrap()
        .into_pages();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: LinkResponse = page.into_body().await.unwrap();
        match page_count {
            1 => {
                let page_pets = page.pets;
                assert_eq!(page_pets.len(), 2);
                assert!(page.next.is_some());
                assert_eq!(page_pets[0].id, Some("1".to_string()));
                assert_eq!(page_pets[0].name, Some("dog".to_string()));
                assert_eq!(page_pets[1].id, Some("2".to_string()));
                assert_eq!(page_pets[1].name, Some("cat".to_string()));
            }
            2 => {
                let page_pets = page.pets;
                assert_eq!(page_pets.len(), 2);
                assert!(page.next.is_none());
                assert_eq!(page_pets[0].id, Some("3".to_string()));
                assert_eq!(page_pets[0].name, Some("bird".to_string()));
                assert_eq!(page_pets[1].id, Some("4".to_string()));
                assert_eq!(page_pets[1].name, Some("fish".to_string()));
            }
            _ => panic!("unexpected page number"),
        }
    }
    assert_eq!(page_count, 2);
}

#[tokio::test]
async fn list_link() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut iter = client
        .get_pageable_server_driven_pagination_client()
        .list_link(None)
        .unwrap();
    let mut item_count = 0;
    while let Some(item) = iter.next().await {
        item_count += 1;
        let item = item.unwrap();
        match item_count {
            1 => {
                assert_eq!(item.id, Some("1".to_string()));
                assert_eq!(item.name, Some("dog".to_string()));
            }
            2 => {
                assert_eq!(item.id, Some("2".to_string()));
                assert_eq!(item.name, Some("cat".to_string()));
            }
            3 => {
                assert_eq!(item.id, Some("3".to_string()));
                assert_eq!(item.name, Some("bird".to_string()));
            }
            4 => {
                assert_eq!(item.id, Some("4".to_string()));
                assert_eq!(item.name, Some("fish".to_string()));
            }
            _ => panic!("unexpected page number"),
        }
    }
    assert_eq!(item_count, 4);
}

#[tokio::test]
async fn list_string() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut iter = client
        .get_pageable_server_driven_pagination_client()
        .list_string(None)
        .unwrap();
    let mut item_count = 0;
    while let Some(item) = iter.next().await {
        item_count += 1;
        let item = item.unwrap();
        match item_count {
            1 => {
                assert_eq!(item.id, Some("1".to_string()));
                assert_eq!(item.name, Some("dog".to_string()));
            }
            2 => {
                assert_eq!(item.id, Some("2".to_string()));
                assert_eq!(item.name, Some("cat".to_string()));
            }
            3 => {
                assert_eq!(item.id, Some("3".to_string()));
                assert_eq!(item.name, Some("bird".to_string()));
            }
            4 => {
                assert_eq!(item.id, Some("4".to_string()));
                assert_eq!(item.name, Some("fish".to_string()));
            }
            _ => panic!("unexpected page number"),
        }
    }
    assert_eq!(item_count, 4);
}
