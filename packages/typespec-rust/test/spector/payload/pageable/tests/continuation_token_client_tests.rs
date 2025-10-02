// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use futures::StreamExt;
use spector_corepageable::{
    models::{
        PageableServerDrivenPaginationContinuationTokenClientListHeaderNestedResponseBodyOptions,
        PageableServerDrivenPaginationContinuationTokenClientListHeaderResponseBodyOptions,
        PageableServerDrivenPaginationContinuationTokenClientListHeaderResponseHeaderOptions,
        PageableServerDrivenPaginationContinuationTokenClientListQueryNestedResponseBodyOptions,
        PageableServerDrivenPaginationContinuationTokenClientListQueryResponseBodyOptions,
        PageableServerDrivenPaginationContinuationTokenClientListQueryResponseHeaderOptions,
        RequestHeaderResponseBodyResponse, RequestHeaderResponseHeaderResponse,
        RequestHeaderResponseHeaderResponseHeaders, RequestQueryResponseBodyResponse,
        RequestQueryResponseHeaderResponse, RequestQueryResponseHeaderResponseHeaders,
    },
    PageableClient,
};

#[tokio::test]
async fn list_header_nested_response_body() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut iter = client
        .get_pageable_server_driven_pagination_client()
        .get_pageable_server_driven_pagination_continuation_token_client()
        .list_header_nested_response_body(Some(
            PageableServerDrivenPaginationContinuationTokenClientListHeaderNestedResponseBodyOptions {
                bar: Some("bar".to_string()),
                foo: Some("foo".to_string()),
                ..Default::default()
            },
        ))
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

#[tokio::test]
async fn list_header_response_body() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut iter = client
        .get_pageable_server_driven_pagination_client()
        .get_pageable_server_driven_pagination_continuation_token_client()
        .list_header_response_body(Some(
            PageableServerDrivenPaginationContinuationTokenClientListHeaderResponseBodyOptions {
                bar: Some("bar".to_string()),
                foo: Some("foo".to_string()),
                ..Default::default()
            },
        ))
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

#[tokio::test]
async fn list_header_response_body_pages() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client
        .get_pageable_server_driven_pagination_client()
        .get_pageable_server_driven_pagination_continuation_token_client()
        .list_header_response_body(Some(
            PageableServerDrivenPaginationContinuationTokenClientListHeaderResponseBodyOptions {
                bar: Some("bar".to_string()),
                foo: Some("foo".to_string()),
                ..Default::default()
            },
        ))
        .unwrap()
        .into_pages();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: RequestHeaderResponseBodyResponse = page.into_body().unwrap();
        match page_count {
            1 => {
                let page_pets = page.pets;
                assert_eq!(page_pets.len(), 2);
                assert!(page.next_token.is_some());
                assert_eq!(page_pets[0].id, Some("1".to_string()));
                assert_eq!(page_pets[0].name, Some("dog".to_string()));
                assert_eq!(page_pets[1].id, Some("2".to_string()));
                assert_eq!(page_pets[1].name, Some("cat".to_string()));
            }
            2 => {
                let page_pets = page.pets;
                assert_eq!(page_pets.len(), 2);
                assert!(page.next_token.is_none());
                assert_eq!(page_pets[0].id, Some("3".to_string()));
                assert_eq!(page_pets[0].name, Some("bird".to_string()));
                assert_eq!(page_pets[1].id, Some("4".to_string()));
                assert_eq!(page_pets[1].name, Some("fish".to_string()));
            }
            _ => {
                panic!("unexpected page number");
            }
        }
    }

    // start at second page
    pager = client
        .get_pageable_server_driven_pagination_client()
        .get_pageable_server_driven_pagination_continuation_token_client()
        .list_header_response_body(Some(
            PageableServerDrivenPaginationContinuationTokenClientListHeaderResponseBodyOptions {
                bar: Some("bar".to_string()),
                foo: Some("foo".to_string()),
                token: Some("page2".to_string()),
                ..Default::default()
            },
        ))
        .unwrap()
        .into_pages();
    page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: RequestHeaderResponseBodyResponse = page.into_body().unwrap();
        match page_count {
            1 => {
                let page_pets = page.pets;
                assert_eq!(page_pets.len(), 2);
                assert!(page.next_token.is_none());
                assert_eq!(page_pets[0].id, Some("3".to_string()));
                assert_eq!(page_pets[0].name, Some("bird".to_string()));
                assert_eq!(page_pets[1].id, Some("4".to_string()));
                assert_eq!(page_pets[1].name, Some("fish".to_string()));
            }
            _ => {
                panic!("unexpected page number");
            }
        }
    }
}

#[tokio::test]
async fn list_header_response_header() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut iter = client
        .get_pageable_server_driven_pagination_client()
        .get_pageable_server_driven_pagination_continuation_token_client()
        .list_header_response_header(Some(
            PageableServerDrivenPaginationContinuationTokenClientListHeaderResponseHeaderOptions {
                bar: Some("bar".to_string()),
                foo: Some("foo".to_string()),
                ..Default::default()
            },
        ))
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

#[tokio::test]
async fn list_header_response_header_pages() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client
        .get_pageable_server_driven_pagination_client()
        .get_pageable_server_driven_pagination_continuation_token_client()
        .list_header_response_header(Some(
            PageableServerDrivenPaginationContinuationTokenClientListHeaderResponseHeaderOptions {
                bar: Some("bar".to_string()),
                foo: Some("foo".to_string()),
                ..Default::default()
            },
        ))
        .unwrap()
        .into_pages();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let next_token = page.next_token().unwrap();
        let page: RequestHeaderResponseHeaderResponse = page.into_body().unwrap();
        match page_count {
            1 => {
                let page_pets = page.pets;
                assert_eq!(page_pets.len(), 2);
                assert!(next_token.is_some());
                assert_eq!(page_pets[0].id, Some("1".to_string()));
                assert_eq!(page_pets[0].name, Some("dog".to_string()));
                assert_eq!(page_pets[1].id, Some("2".to_string()));
                assert_eq!(page_pets[1].name, Some("cat".to_string()));
            }
            2 => {
                let page_pets = page.pets;
                assert_eq!(page_pets.len(), 2);
                assert!(next_token.is_none());
                assert_eq!(page_pets[0].id, Some("3".to_string()));
                assert_eq!(page_pets[0].name, Some("bird".to_string()));
                assert_eq!(page_pets[1].id, Some("4".to_string()));
                assert_eq!(page_pets[1].name, Some("fish".to_string()));
            }
            _ => {
                panic!("unexpected page number");
            }
        }
    }

    // start at second page
    pager = client
        .get_pageable_server_driven_pagination_client()
        .get_pageable_server_driven_pagination_continuation_token_client()
        .list_header_response_header(Some(
            PageableServerDrivenPaginationContinuationTokenClientListHeaderResponseHeaderOptions {
                bar: Some("bar".to_string()),
                foo: Some("foo".to_string()),
                token: Some("page2".to_string()),
                ..Default::default()
            },
        ))
        .unwrap()
        .into_pages();
    page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let next_token = page.next_token().unwrap();
        let page: RequestHeaderResponseHeaderResponse = page.into_body().unwrap();
        match page_count {
            1 => {
                let page_pets = page.pets;
                assert_eq!(page_pets.len(), 2);
                assert!(next_token.is_none());
                assert_eq!(page_pets[0].id, Some("3".to_string()));
                assert_eq!(page_pets[0].name, Some("bird".to_string()));
                assert_eq!(page_pets[1].id, Some("4".to_string()));
                assert_eq!(page_pets[1].name, Some("fish".to_string()));
            }
            _ => {
                panic!("unexpected page number");
            }
        }
    }
}

#[tokio::test]
async fn list_query_nested_response_body() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut iter = client
        .get_pageable_server_driven_pagination_client()
        .get_pageable_server_driven_pagination_continuation_token_client()
        .list_query_nested_response_body(Some(
            PageableServerDrivenPaginationContinuationTokenClientListQueryNestedResponseBodyOptions {
                bar: Some("bar".to_string()),
                foo: Some("foo".to_string()),
                ..Default::default()
            },
        ))
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

#[tokio::test]
async fn list_query_response_body() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut iter = client
        .get_pageable_server_driven_pagination_client()
        .get_pageable_server_driven_pagination_continuation_token_client()
        .list_query_response_body(Some(
            PageableServerDrivenPaginationContinuationTokenClientListQueryResponseBodyOptions {
                bar: Some("bar".to_string()),
                foo: Some("foo".to_string()),
                ..Default::default()
            },
        ))
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

#[tokio::test]
async fn list_query_response_body_pages() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client
        .get_pageable_server_driven_pagination_client()
        .get_pageable_server_driven_pagination_continuation_token_client()
        .list_query_response_body(Some(
            PageableServerDrivenPaginationContinuationTokenClientListQueryResponseBodyOptions {
                bar: Some("bar".to_string()),
                foo: Some("foo".to_string()),
                ..Default::default()
            },
        ))
        .unwrap()
        .into_pages();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: RequestQueryResponseBodyResponse = page.into_body().unwrap();
        match page_count {
            1 => {
                let page_pets = page.pets;
                assert_eq!(page_pets.len(), 2);
                assert!(page.next_token.is_some());
                assert_eq!(page_pets[0].id, Some("1".to_string()));
                assert_eq!(page_pets[0].name, Some("dog".to_string()));
                assert_eq!(page_pets[1].id, Some("2".to_string()));
                assert_eq!(page_pets[1].name, Some("cat".to_string()));
            }
            2 => {
                let page_pets = page.pets;
                assert_eq!(page_pets.len(), 2);
                assert!(page.next_token.is_none());
                assert_eq!(page_pets[0].id, Some("3".to_string()));
                assert_eq!(page_pets[0].name, Some("bird".to_string()));
                assert_eq!(page_pets[1].id, Some("4".to_string()));
                assert_eq!(page_pets[1].name, Some("fish".to_string()));
            }
            _ => {
                panic!("unexpected page number");
            }
        }
    }

    // start at second page
    pager = client
        .get_pageable_server_driven_pagination_client()
        .get_pageable_server_driven_pagination_continuation_token_client()
        .list_query_response_body(Some(
            PageableServerDrivenPaginationContinuationTokenClientListQueryResponseBodyOptions {
                bar: Some("bar".to_string()),
                foo: Some("foo".to_string()),
                token: Some("page2".to_string()),
                ..Default::default()
            },
        ))
        .unwrap()
        .into_pages();
    page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: RequestQueryResponseBodyResponse = page.into_body().unwrap();
        match page_count {
            1 => {
                let page_pets = page.pets;
                assert_eq!(page_pets.len(), 2);
                assert!(page.next_token.is_none());
                assert_eq!(page_pets[0].id, Some("3".to_string()));
                assert_eq!(page_pets[0].name, Some("bird".to_string()));
                assert_eq!(page_pets[1].id, Some("4".to_string()));
                assert_eq!(page_pets[1].name, Some("fish".to_string()));
            }
            _ => {
                panic!("unexpected page number");
            }
        }
    }
}

#[tokio::test]
async fn list_query_response_header() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut iter = client
        .get_pageable_server_driven_pagination_client()
        .get_pageable_server_driven_pagination_continuation_token_client()
        .list_query_response_header(Some(
            PageableServerDrivenPaginationContinuationTokenClientListQueryResponseHeaderOptions {
                bar: Some("bar".to_string()),
                foo: Some("foo".to_string()),
                ..Default::default()
            },
        ))
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

#[tokio::test]
async fn list_query_response_header_pages() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client
        .get_pageable_server_driven_pagination_client()
        .get_pageable_server_driven_pagination_continuation_token_client()
        .list_query_response_header(Some(
            PageableServerDrivenPaginationContinuationTokenClientListQueryResponseHeaderOptions {
                bar: Some("bar".to_string()),
                foo: Some("foo".to_string()),
                ..Default::default()
            },
        ))
        .unwrap()
        .into_pages();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let next_token = page.next_token().unwrap();
        let page: RequestQueryResponseHeaderResponse = page.into_body().unwrap();
        match page_count {
            1 => {
                let page_pets = page.pets;
                assert_eq!(page_pets.len(), 2);
                assert!(next_token.is_some());
                assert_eq!(page_pets[0].id, Some("1".to_string()));
                assert_eq!(page_pets[0].name, Some("dog".to_string()));
                assert_eq!(page_pets[1].id, Some("2".to_string()));
                assert_eq!(page_pets[1].name, Some("cat".to_string()));
            }
            2 => {
                let page_pets = page.pets;
                assert_eq!(page_pets.len(), 2);
                assert!(next_token.is_none());
                assert_eq!(page_pets[0].id, Some("3".to_string()));
                assert_eq!(page_pets[0].name, Some("bird".to_string()));
                assert_eq!(page_pets[1].id, Some("4".to_string()));
                assert_eq!(page_pets[1].name, Some("fish".to_string()));
            }
            _ => {
                panic!("unexpected page number");
            }
        }
    }

    // start at second page
    pager = client
        .get_pageable_server_driven_pagination_client()
        .get_pageable_server_driven_pagination_continuation_token_client()
        .list_query_response_header(Some(
            PageableServerDrivenPaginationContinuationTokenClientListQueryResponseHeaderOptions {
                bar: Some("bar".to_string()),
                foo: Some("foo".to_string()),
                token: Some("page2".to_string()),
                ..Default::default()
            },
        ))
        .unwrap()
        .into_pages();
    page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let next_token = page.next_token().unwrap();
        let page: RequestQueryResponseHeaderResponse = page.into_body().unwrap();
        match page_count {
            1 => {
                let page_pets = page.pets;
                assert_eq!(page_pets.len(), 2);
                assert!(next_token.is_none());
                assert_eq!(page_pets[0].id, Some("3".to_string()));
                assert_eq!(page_pets[0].name, Some("bird".to_string()));
                assert_eq!(page_pets[1].id, Some("4".to_string()));
                assert_eq!(page_pets[1].name, Some("fish".to_string()));
            }
            _ => {
                panic!("unexpected page number");
            }
        }
    }
}
