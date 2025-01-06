// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use cadl_duration::DurationClient;

#[async_std::test]
async fn default() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_query_client()
        .default("P40D".to_string(), None)
        .await
        .unwrap();
}

#[async_std::test]
async fn float64_seconds() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_query_client()
        .float64_seconds(35.625, None)
        .await
        .unwrap();
}

#[async_std::test]
async fn float_seconds() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_query_client()
        .float_seconds(35.625, None)
        .await
        .unwrap();
}

#[async_std::test]
async fn int32_seconds() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_query_client()
        .int32_seconds(36, None)
        .await
        .unwrap();
}

#[async_std::test]
async fn int32_seconds_array() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_query_client()
        .int32_seconds_array(vec![36, 47], None)
        .await
        .unwrap();
}

#[async_std::test]
async fn iso8601() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_query_client()
        .iso8601("P40D".to_string(), None)
        .await
        .unwrap();
}
