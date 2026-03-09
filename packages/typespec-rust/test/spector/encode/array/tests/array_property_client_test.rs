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

#[tokio::test]
async fn comma_delimited() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = CommaDelimitedArrayProperty {
        value: Some(vec![
            "a".to_string(),
            "b".to_string(),
            "c".to_string(),
        ]),
    };
    client
        .get_array_property_client()
        .comma_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn enum_comma_delimited() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = CommaDelimitedEnumArrayProperty {
        value: Some(vec![Colors::Red, Colors::Green, Colors::Blue]),
    };
    client
        .get_array_property_client()
        .enum_comma_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn extensible_enum_comma_delimited() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = CommaDelimitedExtensibleEnumArrayProperty {
        value: Some(vec![
            ColorsExtensibleEnum::Red,
            ColorsExtensibleEnum::Green,
            ColorsExtensibleEnum::Blue,
        ]),
    };
    client
        .get_array_property_client()
        .extensible_enum_comma_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn newline_delimited() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = NewlineDelimitedArrayProperty {
        value: Some(vec![
            "a".to_string(),
            "b".to_string(),
            "c".to_string(),
        ]),
    };
    client
        .get_array_property_client()
        .newline_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn enum_newline_delimited() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = NewlineDelimitedEnumArrayProperty {
        value: Some(vec![Colors::Red, Colors::Green, Colors::Blue]),
    };
    client
        .get_array_property_client()
        .enum_newline_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn extensible_enum_newline_delimited() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = NewlineDelimitedExtensibleEnumArrayProperty {
        value: Some(vec![
            ColorsExtensibleEnum::Red,
            ColorsExtensibleEnum::Green,
            ColorsExtensibleEnum::Blue,
        ]),
    };
    client
        .get_array_property_client()
        .extensible_enum_newline_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn pipe_delimited() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = PipeDelimitedArrayProperty {
        value: Some(vec![
            "a".to_string(),
            "b".to_string(),
            "c".to_string(),
        ]),
    };
    client
        .get_array_property_client()
        .pipe_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn enum_pipe_delimited() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = PipeDelimitedEnumArrayProperty {
        value: Some(vec![Colors::Red, Colors::Green, Colors::Blue]),
    };
    client
        .get_array_property_client()
        .enum_pipe_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn extensible_enum_pipe_delimited() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = PipeDelimitedExtensibleEnumArrayProperty {
        value: Some(vec![
            ColorsExtensibleEnum::Red,
            ColorsExtensibleEnum::Green,
            ColorsExtensibleEnum::Blue,
        ]),
    };
    client
        .get_array_property_client()
        .extensible_enum_pipe_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn space_delimited() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = SpaceDelimitedArrayProperty {
        value: Some(vec![
            "a".to_string(),
            "b".to_string(),
            "c".to_string(),
        ]),
    };
    client
        .get_array_property_client()
        .space_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn enum_space_delimited() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = SpaceDelimitedEnumArrayProperty {
        value: Some(vec![Colors::Red, Colors::Green, Colors::Blue]),
    };
    client
        .get_array_property_client()
        .enum_space_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
}

#[tokio::test]
async fn extensible_enum_space_delimited() {
    let client = ArrayClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input = SpaceDelimitedExtensibleEnumArrayProperty {
        value: Some(vec![
            ColorsExtensibleEnum::Red,
            ColorsExtensibleEnum::Green,
            ColorsExtensibleEnum::Blue,
        ]),
    };
    client
        .get_array_property_client()
        .extensible_enum_space_delimited(input.try_into().unwrap(), None)
        .await
        .unwrap();
}
