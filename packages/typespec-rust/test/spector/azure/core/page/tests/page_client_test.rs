// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use futures::StreamExt;
use spector_corepage::{
    models::{
        ListItemInputBody, ListItemInputExtensibleEnum,
        PageClientListWithParameterizedNextLinkOptions, PageClientListWithParametersOptions,
        PagedUser, UserListResults,
    },
    PageClient,
};

#[tokio::test]
async fn list_with_parameterized_next_link() {
    let client = PageClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client
        .list_with_parameterized_next_link(
            "name",
            Some(PageClientListWithParameterizedNextLinkOptions {
                include_pending: Some(true),
                ..Default::default()
            }),
        )
        .unwrap();
    let mut item_count = 0;
    while let Some(page) = pager.next().await {
        item_count += 1;
        let item = page.unwrap();
        match item_count {
            1 => {
                assert_eq!(item.id, Some(1));
                assert_eq!(item.name, Some("User1".to_string()));
            }
            2 => {
                assert_eq!(item.id, Some(2));
                assert_eq!(item.name, Some("User2".to_string()));
            }
            _ => panic!("unexpected page number"),
        }
    }
}

#[tokio::test]
async fn list_with_custom_page_model() {
    let client = PageClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut iter = client.list_with_custom_page_model(None).unwrap();
    let mut item_count = 0;
    while let Some(item) = iter.next().await {
        item_count += 1;
        let item = item.unwrap();
        match item_count {
            1 => {
                assert_eq!(
                    item.etag,
                    Some(azure_core::http::Etag::from(
                        "11bdc430-65e8-45ad-81d9-8ffa60d55b59"
                    ))
                );
                assert_eq!(item.id, Some(1));
                assert_eq!(item.name, Some("Madge".to_string()));
            }
            _ => panic!("unexpected item number"),
        }
    }
}

#[tokio::test]
async fn list_with_custom_page_model_pages() {
    let client = PageClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client
        .list_with_custom_page_model(None)
        .unwrap()
        .into_pages();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: UserListResults = page.into_body().unwrap();
        match page_count {
            1 => {
                let page_items = page.items;
                assert_eq!(page_items.len(), 1);
                assert!(page.next_link.is_none());
                assert_eq!(
                    page_items[0].etag,
                    Some(azure_core::http::Etag::from(
                        "11bdc430-65e8-45ad-81d9-8ffa60d55b59"
                    ))
                );
                assert_eq!(page_items[0].id, Some(1));
                assert_eq!(page_items[0].name, Some("Madge".to_string()));
            }
            _ => panic!("unexpected page number"),
        }
    }
}

#[tokio::test]
async fn list_with_page() {
    let client = PageClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut iter = client.list_with_page(None).unwrap();
    let mut item_count = 0;
    while let Some(item) = iter.next().await {
        item_count += 1;
        let item = item.unwrap();
        match item_count {
            1 => {
                assert_eq!(
                    item.etag,
                    Some(azure_core::http::Etag::from(
                        "11bdc430-65e8-45ad-81d9-8ffa60d55b59"
                    ))
                );
                assert_eq!(item.id, Some(1));
                assert_eq!(item.name, Some("Madge".to_string()));
            }
            _ => panic!("unexpected item number"),
        }
    }
}

#[tokio::test]
async fn list_with_page_pages() {
    let client = PageClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client.list_with_page(None).unwrap().into_pages();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: PagedUser = page.into_body().unwrap();
        match page_count {
            1 => {
                let page_value = page.value;
                assert_eq!(page_value.len(), 1);
                assert!(page.next_link.is_none());
                assert_eq!(
                    page_value[0].etag,
                    Some(azure_core::http::Etag::from(
                        "11bdc430-65e8-45ad-81d9-8ffa60d55b59"
                    ))
                );
                assert_eq!(page_value[0].id, Some(1));
                assert_eq!(page_value[0].name, Some("Madge".to_string()));
            }
            _ => panic!("unexpected page number"),
        }
    }
}

#[tokio::test]
async fn list_with_parameters() {
    let client = PageClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut iter = client
        .list_with_parameters(
            ListItemInputBody {
                input_name: Some("Madge".to_string()),
            }
            .try_into()
            .unwrap(),
            Some(PageClientListWithParametersOptions {
                another: Some(ListItemInputExtensibleEnum::Second),
                ..Default::default()
            }),
        )
        .unwrap();
    let mut item_count = 0;
    while let Some(item) = iter.next().await {
        item_count += 1;
        let item = item.unwrap();
        match item_count {
            1 => {
                assert_eq!(
                    item.etag,
                    Some(azure_core::http::Etag::from(
                        "11bdc430-65e8-45ad-81d9-8ffa60d55b59"
                    ))
                );
                assert_eq!(item.id, Some(1));
                assert_eq!(item.name, Some("Madge".to_string()));
            }
            _ => panic!("unexpected item number"),
        }
    }
}

#[tokio::test]
async fn list_with_parameters_pages() {
    let client = PageClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client
        .list_with_parameters(
            ListItemInputBody {
                input_name: Some("Madge".to_string()),
            }
            .try_into()
            .unwrap(),
            Some(PageClientListWithParametersOptions {
                another: Some(ListItemInputExtensibleEnum::Second),
                ..Default::default()
            }),
        )
        .unwrap()
        .into_pages();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: PagedUser = page.into_body().unwrap();
        match page_count {
            1 => {
                let page_value = page.value;
                assert_eq!(page_value.len(), 1);
                assert!(page.next_link.is_none());
                assert_eq!(
                    page_value[0].etag,
                    Some(azure_core::http::Etag::from(
                        "11bdc430-65e8-45ad-81d9-8ffa60d55b59"
                    ))
                );
                assert_eq!(page_value[0].id, Some(1));
                assert_eq!(page_value[0].name, Some("Madge".to_string()));
            }
            _ => panic!("unexpected page number"),
        }
    }
}
