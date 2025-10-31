// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_enumconflict::{
    models::{SecondModel, SecondStatus},
    EnumConflictClient,
};

#[tokio::test]
async fn first() {
    let client = EnumConflictClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = SecondModel {
        description: Some("test description".to_string()),
        status: Some(SecondStatus::Running),
    };
    let resp = client
        .get_enum_conflict_second_operations_client()
        .second(body.try_into().unwrap(), None)
        .await
        .unwrap();
    let resp = resp.into_body().unwrap();
    assert_eq!(resp.description, Some("test description".to_string()));
    assert_eq!(resp.status, Some(SecondStatus::Running));
}
