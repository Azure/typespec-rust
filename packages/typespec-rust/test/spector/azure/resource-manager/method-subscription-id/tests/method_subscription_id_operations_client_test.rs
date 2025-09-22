// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

mod common;

use futures::StreamExt;

#[tokio::test]
async fn operations_list() {
    let client = common::create_client();

    let mut iter = client
        .get_method_subscription_id_operations_client()
        .list(None)
        .unwrap();

    let mut item_count = 0;
    while let Some(item) = iter.next().await {
        item_count += 1;
        let item = item.unwrap();
        match item_count {
            1 => {
                assert!(item.action_type.is_none());
                let display = item.display.unwrap();
                assert_eq!(
                    display.description,
                    Some("Lists registered services".to_string())
                );
                assert_eq!(display.operation, Some("Lists services".to_string()));
                assert_eq!(
                    display.provider,
                    Some("Azure.ResourceManager.MethodSubscriptionId".to_string())
                );
                assert_eq!(display.resource, Some("services".to_string()));
                assert_eq!(item.is_data_action, Some(false));
                assert_eq!(
                    item.name,
                    Some("Azure.ResourceManager.MethodSubscriptionId/services/read".to_string())
                );
                assert!(item.origin.is_none());
            }
            _ => panic!("unexpected item number"),
        }
    }
}
