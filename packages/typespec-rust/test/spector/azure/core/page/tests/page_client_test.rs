// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use futures::StreamExt;
use spector_corepage::{
    models::{
        ListItemInputBody, ListItemInputExtensibleEnum, PageClientListWithParametersOptions,
        PagedUser, UserListResults,
    },
    PageClient,
};

/*#[tokio::test]
async fn list_parameterized_next_link() {
    let client = PageClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client
        .list_parameterized_next_link(
            "name",
            Some(PageClientListParameterizedNextLinkOptions {
                include_pending: Some(true),
                ..Default::default()
            }),
        )
        .unwrap();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: ParameterizedNextLinkPagingResult = page.into_body().await.unwrap();
        match page_count {
            1 => {
                assert_eq!(page.values.len(), 1);
                assert!(page.next_link.is_some());
                assert_eq!(page.values[0].id, Some(1));
                assert_eq!(page.values[0].name, Some("User1".to_string()));
            }
            2 => {
                assert_eq!(page.values.len(), 1);
                assert!(page.next_link.is_none());
                assert_eq!(page.values[0].id, Some(2));
                assert_eq!(page.values[0].name, Some("User2".to_string()));
            }
            _ => panic!("unexpected page number"),
        }
    }
}*/

#[tokio::test]
async fn list_with_custom_page_model() {
    let client = PageClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client.list_with_custom_page_model(None).unwrap();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: UserListResults = page.into_body().await.unwrap();
        match page_count {
            1 => {
                let page_items = page.items.unwrap();
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
    let mut pager = client.list_with_page(None).unwrap();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: PagedUser = page.into_body().await.unwrap();
        match page_count {
            1 => {
                let page_value = page.value.unwrap();
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
        .unwrap();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: PagedUser = page.into_body().await.unwrap();
        match page_count {
            1 => {
                let page_value = page.value.unwrap();
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
