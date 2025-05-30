// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

mod common;

use futures::StreamExt;
use spector_armoptemplates::models::{ActionType, Origin};

#[tokio::test]
async fn test_list_operations() {
    let client = common::create_client();

    // Call the list method
    let mut pager = client
        .get_operation_templates_operations_client()
        .list(None)
        .unwrap();

    let mut page_count = 0;
    while let Some(page) = pager.next().await {
        page_count += 1;
        let page = page.unwrap();
        let page = page.into_body().await.unwrap();
        match page_count {
            1 => {
                let value = page.value;
                assert_eq!(value.len(), 1);

                let operation = &value[0];
                assert_eq!(operation.action_type, Some(ActionType::Internal));
                assert_eq!(operation.is_data_action, Some(false));
                assert_eq!(
                    operation.name,
                    Some("Microsoft.Compute/virtualMachines/write".to_string())
                );
                assert_eq!(operation.origin, Some(Origin::Usersystem));

                let display = operation.display.as_ref().unwrap();
                assert_eq!(
                    display.description,
                    Some("Add or modify virtual machines.".to_string())
                );
                assert_eq!(
                    display.operation,
                    Some("Create or Update Virtual Machine.".to_string())
                );
                assert_eq!(display.provider, Some("Microsoft Compute".to_string()));
                assert_eq!(display.resource, Some("Virtual Machines".to_string()));
            }
            _ => panic!("unexpected page number"),
        }
    }
}
