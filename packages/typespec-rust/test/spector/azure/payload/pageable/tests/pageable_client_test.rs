// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use futures::StreamExt;
use spector_azurepageable::{models::PagedUser, PageableClient, PageableClientListOptions};

#[tokio::test]
async fn list() {
    let client = PageableClient::with_no_credential("http://localhost:3000", None).unwrap();
    let mut pager = client
        .list(Some(PageableClientListOptions {
            maxpagesize: Some(3),
            ..Default::default()
        }))
        .unwrap();
    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page: PagedUser = page.into_body().await.unwrap();
        let value = page.value.unwrap();
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
