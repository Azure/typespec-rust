// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

mod common;

use futures::StreamExt;
use spector_armoptemplates::models::{
    LogStatusRequest, OperationTemplatesPagingClientListPostActionPagingOptions,
};

#[tokio::test]
async fn mark_as_pageable() {
    let client = common::create_client();

    let mut pager = client
        .get_operation_templates_paging_client()
        .list_mark_as_pageable("test-rg", "monitor1", None)
        .unwrap();

    let mut item_count = 0;
    while let Some(item) = pager.next().await {
        let item = item.unwrap();
        item_count += 1;
        match item_count {
            1 => {
                assert_eq!(item.name, Some("collection1".to_string()));
                assert_eq!(
                    item.properties.as_ref().unwrap().display_name,
                    Some("Test Collection".to_string())
                );
            }
            2 => {
                assert_eq!(item.name, Some("collection2".to_string()));
                assert_eq!(
                    item.properties.as_ref().unwrap().display_name,
                    Some("Another Collection".to_string())
                );
            }
            _ => panic!("unexpected item count"),
        }
    }
    assert_eq!(item_count, 2);
}

// TODO: the generated `list_post_action_paging` pager always returns
// `PagerResult::Done` and does not follow `nextLink`, so only the first page is
// returned instead of both pages.
// https://github.com/Azure/typespec-rust/issues/1029
#[ignore = "generated postActionPaging pager does not follow nextLink"]
#[tokio::test]
async fn post_action_paging() {
    let client = common::create_client();

    let options = Some(OperationTemplatesPagingClientListPostActionPagingOptions {
        body: Some(
            LogStatusRequest {
                filter: Some("status eq 'active'".to_string()),
            }
            .try_into()
            .unwrap(),
        ),
        ..Default::default()
    });

    let mut pager = client
        .get_operation_templates_paging_client()
        .list_post_action_paging("test-rg", "monitor1", options)
        .unwrap();

    let mut item_count = 0;
    while let Some(item) = pager.next().await {
        let item = item.unwrap();
        item_count += 1;
        match item_count {
            1 => {
                assert_eq!(
                    item.id,
                    Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.Compute/virtualMachines/vm1".to_string())
                );
                assert_eq!(item.sending_metrics, Some(true));
            }
            2 => {
                assert_eq!(
                    item.id,
                    Some("/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/test-rg/providers/Microsoft.Compute/virtualMachines/vm2".to_string())
                );
                assert_eq!(item.sending_metrics, Some(false));
            }
            _ => panic!("unexpected item count"),
        }
    }
    assert_eq!(item_count, 2);
}

// TODO: the generated `list_post_action_paging` pager always returns
// `PagerResult::Done` and does not follow `nextLink`, so only the first page is
// returned instead of both pages.
// https://github.com/Azure/typespec-rust/issues/1029
#[ignore = "generated postActionPaging pager does not follow nextLink"]
#[tokio::test]
async fn post_action_paging_pages() {
    let client = common::create_client();

    let options = Some(OperationTemplatesPagingClientListPostActionPagingOptions {
        body: Some(
            LogStatusRequest {
                filter: Some("status eq 'active'".to_string()),
            }
            .try_into()
            .unwrap(),
        ),
        ..Default::default()
    });

    let mut pager = client
        .get_operation_templates_paging_client()
        .list_post_action_paging("test-rg", "monitor1", options)
        .unwrap()
        .into_pages();

    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        let page = page.unwrap().into_model().unwrap();
        page_count += 1;
        assert_eq!(page.value.len(), 1);
        match page_count {
            1 => {
                assert_eq!(page.value[0].sending_metrics, Some(true));
            }
            2 => {
                assert_eq!(page.value[0].sending_metrics, Some(false));
            }
            _ => panic!("unexpected page count"),
        }
    }
    assert_eq!(page_count, 2);
}
