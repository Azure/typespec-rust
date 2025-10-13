// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use futures::StreamExt;
use spector_corepageable::{models::PageablePageSizeClientListWithPageSizeOptions, PageableClient};

#[tokio::test]
async fn list_with_page_size() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut iter = client
        .get_pageable_page_size_client()
        .list_with_page_size(Some(PageablePageSizeClientListWithPageSizeOptions {
            page_size: Some(2),
            ..Default::default()
        }))
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
            _ => {
                panic!("unexpected item number");
            }
        }
    }
    assert_eq!(item_count, 2);

    iter = client
        .get_pageable_page_size_client()
        .list_with_page_size(Some(PageablePageSizeClientListWithPageSizeOptions {
            page_size: Some(4),
            ..Default::default()
        }))
        .unwrap();
    item_count = 0;
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
            _ => {
                panic!("unexpected item number");
            }
        }
    }
    assert_eq!(item_count, 4);
}

#[tokio::test]
async fn list_without_continuation() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut iter = client
        .get_pageable_page_size_client()
        .list_without_continuation(None)
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
            _ => {
                panic!("unexpected item number");
            }
        }
    }
    assert_eq!(item_count, 4);
}
