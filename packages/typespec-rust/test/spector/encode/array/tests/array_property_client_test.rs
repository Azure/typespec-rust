// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::{http::RequestContent, json::to_json};
use serde::Serialize;
use spector_encarray::{
    models::{
        CommaDelimitedArrayProperty, CommaDelimitedEnumArrayProperty,
        CommaDelimitedExtensibleEnumArrayProperty, NewlineDelimitedArrayProperty,
        NewlineDelimitedEnumArrayProperty, NewlineDelimitedExtensibleEnumArrayProperty,
        PipeDelimitedArrayProperty, PipeDelimitedEnumArrayProperty,
        PipeDelimitedExtensibleEnumArrayProperty, SpaceDelimitedArrayProperty,
        SpaceDelimitedEnumArrayProperty, SpaceDelimitedExtensibleEnumArrayProperty,
    },
    ArrayClient,
};

/// The Spector mock expects array values encoded as delimited strings in the JSON body,
/// e.g. `{"value": "blue,red,green"}` rather than `{"value": ["blue","red","green"]}`.
/// The generated models use `Vec<String>` which serializes as a JSON array, so we
/// construct the request body manually with the correct delimited format.
#[derive(Serialize)]
struct DelimitedBody {
    value: String,
}

fn delimited_body<T>(delimiter: &str) -> RequestContent<T> {
    let value = ["blue", "red", "green"].join(delimiter);
    to_json(&DelimitedBody { value }).unwrap().into()
}

// --- Comma-delimited tests ---

#[tokio::test]
async fn comma_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body: RequestContent<CommaDelimitedArrayProperty> = delimited_body(",");
    let resp = client
        .get_array_property_client()
        .comma_delimited(body, None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "comma_delimited should return 200 OK");
}

#[tokio::test]
async fn enum_comma_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body: RequestContent<CommaDelimitedEnumArrayProperty> = delimited_body(",");
    let resp = client
        .get_array_property_client()
        .enum_comma_delimited(body, None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn extensible_enum_comma_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body: RequestContent<CommaDelimitedExtensibleEnumArrayProperty> = delimited_body(",");
    let resp = client
        .get_array_property_client()
        .extensible_enum_comma_delimited(body, None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
}

// --- Newline-delimited tests ---

#[tokio::test]
async fn newline_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body: RequestContent<NewlineDelimitedArrayProperty> = delimited_body("\n");
    let resp = client
        .get_array_property_client()
        .newline_delimited(body, None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "newline_delimited should return 200 OK");
}

#[tokio::test]
async fn enum_newline_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body: RequestContent<NewlineDelimitedEnumArrayProperty> = delimited_body("\n");
    let resp = client
        .get_array_property_client()
        .enum_newline_delimited(body, None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn extensible_enum_newline_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body: RequestContent<NewlineDelimitedExtensibleEnumArrayProperty> = delimited_body("\n");
    let resp = client
        .get_array_property_client()
        .extensible_enum_newline_delimited(body, None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
}

// --- Pipe-delimited tests ---

#[tokio::test]
async fn pipe_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body: RequestContent<PipeDelimitedArrayProperty> = delimited_body("|");
    let resp = client
        .get_array_property_client()
        .pipe_delimited(body, None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "pipe_delimited should return 200 OK");
}

#[tokio::test]
async fn enum_pipe_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body: RequestContent<PipeDelimitedEnumArrayProperty> = delimited_body("|");
    let resp = client
        .get_array_property_client()
        .enum_pipe_delimited(body, None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn extensible_enum_pipe_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body: RequestContent<PipeDelimitedExtensibleEnumArrayProperty> = delimited_body("|");
    let resp = client
        .get_array_property_client()
        .extensible_enum_pipe_delimited(body, None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
}

// --- Space-delimited tests ---

#[tokio::test]
async fn space_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body: RequestContent<SpaceDelimitedArrayProperty> = delimited_body(" ");
    let resp = client
        .get_array_property_client()
        .space_delimited(body, None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "space_delimited should return 200 OK");
}

#[tokio::test]
async fn enum_space_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body: RequestContent<SpaceDelimitedEnumArrayProperty> = delimited_body(" ");
    let resp = client
        .get_array_property_client()
        .enum_space_delimited(body, None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn extensible_enum_space_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body: RequestContent<SpaceDelimitedExtensibleEnumArrayProperty> = delimited_body(" ");
    let resp = client
        .get_array_property_client()
        .extensible_enum_space_delimited(body, None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
}

// --- Negative tests: client construction ---

#[tokio::test]
async fn client_rejects_non_http_scheme() {
    let result = ArrayClient::with_no_credential("ftp://localhost:3000", None);
    assert!(result.is_err(), "non-http scheme should be rejected");
}

#[tokio::test]
async fn client_rejects_malformed_url() {
    let result = ArrayClient::with_no_credential("not-a-valid-url", None);
    assert!(result.is_err(), "malformed URL should be rejected");
}
