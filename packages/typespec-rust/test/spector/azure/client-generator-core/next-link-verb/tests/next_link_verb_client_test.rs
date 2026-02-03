// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use futures::StreamExt;
use spector_corenextlinkverb::{models::ListTestResult, NextLinkVerbClient};

#[tokio::test]
async fn list_items() {
    let client = NextLinkVerbClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut iter = client.list_items(None).unwrap();
    let mut item_count = 0;
    while let Some(item) = iter.next().await {
        item_count += 1;
        let item = item.unwrap();
        match item_count {
            1 => {
                assert_eq!(item.id, Some("test1".to_string()));
            }
            2 => {
                assert_eq!(item.id, Some("test2".to_string()));
            }
            _ => {
                panic!("unexpected item number");
            }
        }
    }
    assert_eq!(item_count, 2);
}

#[tokio::test]
async fn list_items_pages() {
    let client = NextLinkVerbClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client.list_items(None).unwrap().into_pages();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: ListTestResult = page.into_model().unwrap();
        let items = page.items;
        match page_count {
            1 => {
                assert_eq!(items.len(), 1);
                assert_eq!(items[0].id, Some("test1".to_string()));
            }
            2 => {
                assert_eq!(items.len(), 1);
                assert_eq!(items[0].id, Some("test2".to_string()));
            }
            _ => {
                panic!("unexpected page number");
            }
        }
    }
    assert_eq!(page_count, 2);
}
