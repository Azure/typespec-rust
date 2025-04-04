// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use futures::StreamExt;
use spector_corepageable::{models::LinkResponse, PageableClient};

#[tokio::test]
async fn list() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client
        .get_pageable_server_driven_pagination_client()
        .list(None)
        .unwrap();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: LinkResponse = page.into_body().await.unwrap();
        match page_count {
            1 => {
                assert_eq!(page.pets.len(), 2);
                assert!(page.next.is_some());
                assert_eq!(page.pets[0].id, Some("1".to_string()));
                assert_eq!(page.pets[0].name, Some("dog".to_string()));
                assert_eq!(page.pets[1].id, Some("2".to_string()));
                assert_eq!(page.pets[1].name, Some("cat".to_string()));
            }
            2 => {
                assert_eq!(page.pets.len(), 2);
                assert!(page.next.is_none());
                assert_eq!(page.pets[0].id, Some("3".to_string()));
                assert_eq!(page.pets[0].name, Some("bird".to_string()));
                assert_eq!(page.pets[1].id, Some("4".to_string()));
                assert_eq!(page.pets[1].name, Some("fish".to_string()));
            }
            _ => panic!("unexpected page number"),
        }
    }
    assert_eq!(page_count, 2);
}
