// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use futures::StreamExt;
use spector_corepageable::{
    models::{XmlPet, XmlPetListResult, XmlPetListResultWithNextLink},
    xml_pagination::models::PageableXmlPaginationClientListWithContinuationOptions,
    PageableClient,
};

#[tokio::test]
async fn list_with_continuation_items() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut iter = client
        .get_pageable_xml_pagination_client()
        .list_with_continuation(None)
        .unwrap();
    let mut item_count = 0;
    while let Some(item) = iter.next().await {
        item_count += 1;
        let item: XmlPet = item.unwrap();
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
async fn list_with_continuation_pages() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client
        .get_pageable_xml_pagination_client()
        .list_with_continuation(None)
        .unwrap()
        .into_pages();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: XmlPetListResult = page.into_model().unwrap();
        match page_count {
            1 => {
                let pets = page.pets;
                assert_eq!(pets.len(), 2);
                assert_eq!(page.next_marker, Some("page2".to_string()));
                assert_eq!(pets[0].id, Some("1".to_string()));
                assert_eq!(pets[0].name, Some("dog".to_string()));
                assert_eq!(pets[1].id, Some("2".to_string()));
                assert_eq!(pets[1].name, Some("cat".to_string()));
            }
            2 => {
                let pets = page.pets;
                assert_eq!(pets.len(), 2);
                assert!(page.next_marker.is_none());
                assert_eq!(pets[0].id, Some("3".to_string()));
                assert_eq!(pets[0].name, Some("bird".to_string()));
                assert_eq!(pets[1].id, Some("4".to_string()));
                assert_eq!(pets[1].name, Some("fish".to_string()));
            }
            _ => {
                panic!("unexpected page number");
            }
        }
    }

    // start at second page
    let mut pager = client
        .get_pageable_xml_pagination_client()
        .list_with_continuation(Some(
            PageableXmlPaginationClientListWithContinuationOptions {
                marker: Some("page2".to_string()),
                ..Default::default()
            },
        ))
        .unwrap()
        .into_pages();
    page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: XmlPetListResult = page.into_model().unwrap();
        match page_count {
            1 => {
                let pets = page.pets;
                assert_eq!(pets.len(), 2);
                assert!(page.next_marker.is_none());
                assert_eq!(pets[0].id, Some("3".to_string()));
                assert_eq!(pets[0].name, Some("bird".to_string()));
                assert_eq!(pets[1].id, Some("4".to_string()));
                assert_eq!(pets[1].name, Some("fish".to_string()));
            }
            _ => {
                panic!("unexpected page number");
            }
        }
    }
}

#[tokio::test]
async fn list_with_next_link_items() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut iter = client
        .get_pageable_xml_pagination_client()
        .list_with_next_link(None)
        .unwrap();
    let mut item_count = 0;
    while let Some(item) = iter.next().await {
        item_count += 1;
        let item: XmlPet = item.unwrap();
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
async fn list_with_next_link_pages() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client
        .get_pageable_xml_pagination_client()
        .list_with_next_link(None)
        .unwrap()
        .into_pages();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: XmlPetListResultWithNextLink = page.into_model().unwrap();
        match page_count {
            1 => {
                let pets = page.pets;
                assert_eq!(pets.len(), 2);
                assert!(page.next_link.is_some());
                assert_eq!(pets[0].id, Some("1".to_string()));
                assert_eq!(pets[0].name, Some("dog".to_string()));
                assert_eq!(pets[1].id, Some("2".to_string()));
                assert_eq!(pets[1].name, Some("cat".to_string()));
            }
            2 => {
                let pets = page.pets;
                assert_eq!(pets.len(), 2);
                assert!(page.next_link.is_none());
                assert_eq!(pets[0].id, Some("3".to_string()));
                assert_eq!(pets[0].name, Some("bird".to_string()));
                assert_eq!(pets[1].id, Some("4".to_string()));
                assert_eq!(pets[1].name, Some("fish".to_string()));
            }
            _ => {
                panic!("unexpected page number");
            }
        }
    }
}
