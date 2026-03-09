// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_encarray::{
    models::{
        Colors, ColorsExtensibleEnum, CommaDelimitedArrayProperty, CommaDelimitedEnumArrayProperty,
        CommaDelimitedExtensibleEnumArrayProperty, NewlineDelimitedArrayProperty,
        NewlineDelimitedEnumArrayProperty, NewlineDelimitedExtensibleEnumArrayProperty,
        PipeDelimitedArrayProperty, PipeDelimitedEnumArrayProperty,
        PipeDelimitedExtensibleEnumArrayProperty, SpaceDelimitedArrayProperty,
        SpaceDelimitedEnumArrayProperty, SpaceDelimitedExtensibleEnumArrayProperty,
    },
    ArrayClient,
};

// --- Comma-delimited tests ---

#[tokio::test]
async fn comma_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = CommaDelimitedArrayProperty {
        value: Some(vec!["a".to_string(), "b".to_string(), "c".to_string()]),
    };
    let resp = client
        .get_array_property_client()
        .comma_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "comma_delimited should return 200 OK");
    let output: CommaDelimitedArrayProperty = resp.into_model().unwrap();
    assert_eq!(
        output.value,
        Some(vec!["a".to_string(), "b".to_string(), "c".to_string()])
    );
}

#[tokio::test]
async fn enum_comma_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = CommaDelimitedEnumArrayProperty {
        value: Some(vec![Colors::Red, Colors::Green, Colors::Blue]),
    };
    let resp = client
        .get_array_property_client()
        .enum_comma_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let output: CommaDelimitedEnumArrayProperty = resp.into_model().unwrap();
    assert_eq!(
        output.value,
        Some(vec![Colors::Red, Colors::Green, Colors::Blue])
    );
}

#[tokio::test]
async fn extensible_enum_comma_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = CommaDelimitedExtensibleEnumArrayProperty {
        value: Some(vec![
            ColorsExtensibleEnum::Red,
            ColorsExtensibleEnum::Green,
            ColorsExtensibleEnum::Blue,
        ]),
    };
    let resp = client
        .get_array_property_client()
        .extensible_enum_comma_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let output: CommaDelimitedExtensibleEnumArrayProperty = resp.into_model().unwrap();
    assert_eq!(
        output.value,
        Some(vec![
            ColorsExtensibleEnum::Red,
            ColorsExtensibleEnum::Green,
            ColorsExtensibleEnum::Blue,
        ])
    );
}

// --- Newline-delimited tests ---

#[tokio::test]
async fn newline_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = NewlineDelimitedArrayProperty {
        value: Some(vec!["a".to_string(), "b".to_string(), "c".to_string()]),
    };
    let resp = client
        .get_array_property_client()
        .newline_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "newline_delimited should return 200 OK");
    let output: NewlineDelimitedArrayProperty = resp.into_model().unwrap();
    assert_eq!(
        output.value,
        Some(vec!["a".to_string(), "b".to_string(), "c".to_string()])
    );
}

#[tokio::test]
async fn enum_newline_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = NewlineDelimitedEnumArrayProperty {
        value: Some(vec![Colors::Red, Colors::Green, Colors::Blue]),
    };
    let resp = client
        .get_array_property_client()
        .enum_newline_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let output: NewlineDelimitedEnumArrayProperty = resp.into_model().unwrap();
    assert_eq!(
        output.value,
        Some(vec![Colors::Red, Colors::Green, Colors::Blue])
    );
}

#[tokio::test]
async fn extensible_enum_newline_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = NewlineDelimitedExtensibleEnumArrayProperty {
        value: Some(vec![
            ColorsExtensibleEnum::Red,
            ColorsExtensibleEnum::Green,
            ColorsExtensibleEnum::Blue,
        ]),
    };
    let resp = client
        .get_array_property_client()
        .extensible_enum_newline_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let output: NewlineDelimitedExtensibleEnumArrayProperty = resp.into_model().unwrap();
    assert_eq!(
        output.value,
        Some(vec![
            ColorsExtensibleEnum::Red,
            ColorsExtensibleEnum::Green,
            ColorsExtensibleEnum::Blue,
        ])
    );
}

// --- Pipe-delimited tests ---

#[tokio::test]
async fn pipe_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = PipeDelimitedArrayProperty {
        value: Some(vec!["a".to_string(), "b".to_string(), "c".to_string()]),
    };
    let resp = client
        .get_array_property_client()
        .pipe_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "pipe_delimited should return 200 OK");
    let output: PipeDelimitedArrayProperty = resp.into_model().unwrap();
    assert_eq!(
        output.value,
        Some(vec!["a".to_string(), "b".to_string(), "c".to_string()])
    );
}

#[tokio::test]
async fn enum_pipe_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = PipeDelimitedEnumArrayProperty {
        value: Some(vec![Colors::Red, Colors::Green, Colors::Blue]),
    };
    let resp = client
        .get_array_property_client()
        .enum_pipe_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let output: PipeDelimitedEnumArrayProperty = resp.into_model().unwrap();
    assert_eq!(
        output.value,
        Some(vec![Colors::Red, Colors::Green, Colors::Blue])
    );
}

#[tokio::test]
async fn extensible_enum_pipe_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = PipeDelimitedExtensibleEnumArrayProperty {
        value: Some(vec![
            ColorsExtensibleEnum::Red,
            ColorsExtensibleEnum::Green,
            ColorsExtensibleEnum::Blue,
        ]),
    };
    let resp = client
        .get_array_property_client()
        .extensible_enum_pipe_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let output: PipeDelimitedExtensibleEnumArrayProperty = resp.into_model().unwrap();
    assert_eq!(
        output.value,
        Some(vec![
            ColorsExtensibleEnum::Red,
            ColorsExtensibleEnum::Green,
            ColorsExtensibleEnum::Blue,
        ])
    );
}

// --- Space-delimited tests ---

#[tokio::test]
async fn space_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = SpaceDelimitedArrayProperty {
        value: Some(vec!["a".to_string(), "b".to_string(), "c".to_string()]),
    };
    let resp = client
        .get_array_property_client()
        .space_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200, "space_delimited should return 200 OK");
    let output: SpaceDelimitedArrayProperty = resp.into_model().unwrap();
    assert_eq!(
        output.value,
        Some(vec!["a".to_string(), "b".to_string(), "c".to_string()])
    );
}

#[tokio::test]
async fn enum_space_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = SpaceDelimitedEnumArrayProperty {
        value: Some(vec![Colors::Red, Colors::Green, Colors::Blue]),
    };
    let resp = client
        .get_array_property_client()
        .enum_space_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let output: SpaceDelimitedEnumArrayProperty = resp.into_model().unwrap();
    assert_eq!(
        output.value,
        Some(vec![Colors::Red, Colors::Green, Colors::Blue])
    );
}

#[tokio::test]
async fn extensible_enum_space_delimited_returns_200_with_matching_values() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = SpaceDelimitedExtensibleEnumArrayProperty {
        value: Some(vec![
            ColorsExtensibleEnum::Red,
            ColorsExtensibleEnum::Green,
            ColorsExtensibleEnum::Blue,
        ]),
    };
    let resp = client
        .get_array_property_client()
        .extensible_enum_space_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let output: SpaceDelimitedExtensibleEnumArrayProperty = resp.into_model().unwrap();
    assert_eq!(
        output.value,
        Some(vec![
            ColorsExtensibleEnum::Red,
            ColorsExtensibleEnum::Green,
            ColorsExtensibleEnum::Blue,
        ])
    );
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
