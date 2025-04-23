// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use futures::StreamExt;
use spector_corepage::{
    models::{PagedFirstItem, PagedSecondItem},
    PageClient,
};

#[tokio::test]
async fn list_first_item() {
    let client = PageClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client
        .get_page_two_models_as_page_item_client()
        .list_first_item(None)
        .unwrap();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: PagedFirstItem = page.into_body().await.unwrap();
        match page_count {
            1 => {
                let page_value = page.value.unwrap();
                assert_eq!(page_value.len(), 1);
                assert!(page.next_link.is_none());
                assert_eq!(page_value[0].id, Some(1));
            }
            _ => panic!("unexpected page number"),
        }
    }
}

#[tokio::test]
async fn list_second_item() {
    let client = PageClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client
        .get_page_two_models_as_page_item_client()
        .list_second_item(None)
        .unwrap();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: PagedSecondItem = page.into_body().await.unwrap();
        match page_count {
            1 => {
                let page_value = page.value.unwrap();
                assert_eq!(page_value.len(), 1);
                assert!(page.next_link.is_none());
                assert_eq!(page_value[0].name, Some("Madge".to_string()));
            }
            _ => panic!("unexpected page number"),
        }
    }
}
