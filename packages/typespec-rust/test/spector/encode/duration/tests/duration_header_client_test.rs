// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_duration::DurationClient;

#[tokio::test]
async fn default() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_header_client()
        .default("P40D".to_string(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn float64_milliseconds() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_header_client()
        .float64_milliseconds(35625.0, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn float64_seconds() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_header_client()
        .float64_seconds(35.625, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn float_milliseconds() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_header_client()
        .float_milliseconds(35625.0, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn float_seconds() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_header_client()
        .float_seconds(35.625, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn int32_milliseconds() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_header_client()
        .int32_milliseconds(36000, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn int32_milliseconds_array() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_header_client()
        .int32_milliseconds_array(&[36000, 47000], None)
        .await
        .unwrap();
}

#[tokio::test]
async fn int32_seconds() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_header_client()
        .int32_seconds(36, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn iso8601() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_header_client()
        .iso8601("P40D".to_string(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn iso8601_array() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_header_client()
        .iso8601_array(&["P40D", "P50D"], None)
        .await
        .unwrap();
}

#[tokio::test]
async fn int32_seconds_larger_unit() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_header_client()
        .int32_seconds_larger_unit(120, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn float_seconds_larger_unit() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_header_client()
        .float_seconds_larger_unit(150.0, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn int32_milliseconds_larger_unit() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_header_client()
        .int32_milliseconds_larger_unit(180000, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn float_milliseconds_larger_unit() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_duration_header_client()
        .float_milliseconds_larger_unit(210000.0, None)
        .await
        .unwrap();
}
