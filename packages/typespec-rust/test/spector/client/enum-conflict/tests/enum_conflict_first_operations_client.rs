// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_enumconflict::{
    models::{FirstModel, Status},
    EnumConflictClient,
};

#[tokio::test]
async fn first() {
    let client = EnumConflictClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = FirstModel {
        name: Some("test".to_string()),
        status: Some(Status::Active),
    };
    let resp = client
        .get_enum_conflict_first_operations_client()
        .first(body.try_into().unwrap(), None)
        .await
        .unwrap();
    let resp = resp.into_body().unwrap();
    assert_eq!(resp.name, Some("test".to_string()));
    assert_eq!(resp.status, Some(Status::Active));
}
