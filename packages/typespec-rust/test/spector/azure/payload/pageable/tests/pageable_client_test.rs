// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use futures::StreamExt;
use spector_azurepageable::{
    models::{PageableClientListOptions, PagedUser},
    PageableClient,
};

#[tokio::test]
async fn list() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut iter = client
        .list(Some(PageableClientListOptions {
            maxpagesize: Some(3),
            ..Default::default()
        }))
        .unwrap();
    let mut item_count = 0;
    while let Some(item) = iter.next().await {
        item_count += 1;
        let item = item.unwrap();
        match item_count {
            1 => {
                assert_eq!(item.name, Some("user5".to_string()));
            }
            2 => {
                assert_eq!(item.name, Some("user6".to_string()));
            }
            3 => {
                assert_eq!(item.name, Some("user7".to_string()));
            }
            4 => {
                assert_eq!(item.name, Some("user8".to_string()));
            }
            _ => {
                panic!("unexpected item number");
            }
        }
    }
    assert_eq!(item_count, 4);
}

#[tokio::test]
async fn list_pages() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client
        .list(Some(PageableClientListOptions {
            maxpagesize: Some(3),
            ..Default::default()
        }))
        .unwrap()
        .into_pages();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: PagedUser = page.into_model().unwrap();
        let value = page.value;
        match page_count {
            1 => {
                assert_eq!(value.len(), 3);
                assert_eq!(value[0].name, Some("user5".to_string()));
                assert_eq!(value[1].name, Some("user6".to_string()));
                assert_eq!(value[2].name, Some("user7".to_string()));
            }
            2 => {
                assert_eq!(value.len(), 1);
                assert_eq!(value[0].name, Some("user8".to_string()));
            }
            _ => {
                panic!("unexpected page number");
            }
        }
    }
    assert_eq!(page_count, 2);
}
