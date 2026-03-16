// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::{
    http::{headers::Headers, RawResponse, Response, StatusCode},
    json::to_json,
    time::OffsetDateTime,
};
use serde_tests::models::{
    AddlPropsInt, AddlPropsString, AddlPropsUnknown, BaseType, Derivedtype, ExtensibleValues,
    WithNumericEnum,
};
use std::collections::HashMap;

#[tokio::test]
async fn test_addl_props_int_de() {
    let json_data = r#"{"count":123,"other1":456,"other2":789}"#;
    let resp: Response<AddlPropsInt> =
        RawResponse::from_bytes(StatusCode::Ok, Headers::new(), json_data).into();
    let addl_props_int = resp.into_model().unwrap();
    let hm_i32 = addl_props_int.additional_properties.unwrap();
    assert_eq!(addl_props_int.count, Some(123));
    assert_eq!(hm_i32.len(), 2);
    assert_eq!(hm_i32["other1"], 456);
    assert_eq!(hm_i32["other2"], 789);
}

#[tokio::test]
async fn test_addl_props_int_se() {
    let mut addl_props_int = AddlPropsInt::default();
    addl_props_int.additional_properties = Some(HashMap::from([("other1".to_string(), 456)]));
    addl_props_int.count = Some(123);
    let json_body = to_json(&addl_props_int).unwrap();
    assert_eq!(json_body, r#"{"other1":456,"count":123}"#);
}

#[tokio::test]
async fn test_addl_props_string_de() {
    let json_data = r#"{"name":"foo","other1":"bar","other2":"baz"}"#;
    let resp: Response<AddlPropsString> =
        RawResponse::from_bytes(StatusCode::Ok, Headers::new(), json_data).into();
    let addl_props_string = resp.into_model().unwrap();
    let hm_string = addl_props_string.additional_properties.unwrap();
    assert_eq!(addl_props_string.name, Some("foo".to_string()));
    assert_eq!(hm_string.len(), 2);
    assert_eq!(hm_string["other1"], "bar");
    assert_eq!(hm_string["other2"], "baz");
}

#[tokio::test]
async fn test_addl_props_string_se() {
    let mut addl_props_string = AddlPropsString::default();
    addl_props_string.additional_properties =
        Some(HashMap::from([("other1".to_string(), "bar".to_string())]));
    addl_props_string.name = Some("foo".to_string());
    let json_body = to_json(&addl_props_string).unwrap();
    assert_eq!(json_body, r#"{"other1":"bar","name":"foo"}"#);
}

#[tokio::test]
async fn test_addl_props_unknown_de() {
    let json_data = r#"{"count":123,"name":"foo","other1":false,"other2":7.89}"#;
    let resp: Response<AddlPropsUnknown> =
        RawResponse::from_bytes(StatusCode::Ok, Headers::new(), json_data).into();
    let addl_props_unknown = resp.into_model().unwrap();
    let hm_value = addl_props_unknown.additional_properties.unwrap();
    assert_eq!(addl_props_unknown.count, Some(123));
    assert_eq!(addl_props_unknown.name, Some("foo".to_string()));
    assert_eq!(hm_value.len(), 2);
    assert_eq!(hm_value["other1"], false);
    assert_eq!(hm_value["other2"], 7.89);
}

#[tokio::test]
async fn test_addl_props_unknown_se() {
    let mut addl_props_unknown = AddlPropsUnknown::default();
    addl_props_unknown.additional_properties = Some(HashMap::from([(
        "other1".to_string(),
        serde_json::Value::Bool(false),
    )]));
    addl_props_unknown.count = Some(123);
    addl_props_unknown.name = Some("foo".to_string());
    let json_body = to_json(&addl_props_unknown).unwrap();
    assert_eq!(json_body, r#"{"other1":false,"count":123,"name":"foo"}"#);
}

#[tokio::test]
async fn test_with_numeric_enum_de() {
    let json_data = r#"{"value":789}"#;
    let resp: Response<WithNumericEnum> =
        RawResponse::from_bytes(StatusCode::Ok, Headers::new(), json_data).into();
    let with_numeric_enum = resp.into_model().unwrap();
    assert_eq!(
        with_numeric_enum.value,
        Some(ExtensibleValues::UnknownValue(789))
    );
}

#[tokio::test]
async fn test_with_numeric_enum_se() {
    let mut with_numeric_enum = WithNumericEnum::default();
    with_numeric_enum.value = Some(ExtensibleValues::UnknownValue(789));
    let json_body = to_json(&with_numeric_enum).unwrap();
    assert_eq!(json_body, r#"{"value":789}"#);
}

#[tokio::test]
async fn test_base_type_se() {
    let mut derived = Derivedtype::default();
    derived.count = Some(7);
    derived.data = Some(vec![0xFF]);
    derived.time = Some(OffsetDateTime::UNIX_EPOCH);
    let base = BaseType::Derivedtype(derived);
    let json_body = to_json(&base).unwrap();
    let v: serde_json::Value = serde_json::from_slice(&json_body).unwrap();
    assert_eq!(v["kind"], "derived");
    assert_eq!(v["count"], 7);
    // 0xFF -> base64-url no pad -> "_w"
    assert_eq!(v["data"], "_w");
    // time is RFC 7231 formatted
    assert_eq!(v["time"], "Thu, 01 Jan 1970 00:00:00 GMT");
}

#[tokio::test]
async fn test_derived_type_se() {
    let mut derived = Derivedtype::default();
    derived.count = Some(42);
    derived.data = Some(vec![0xDE, 0xAD]);
    derived.time = Some(OffsetDateTime::UNIX_EPOCH);
    let json_body = to_json(&derived).unwrap();
    let v: serde_json::Value = serde_json::from_slice(&json_body).unwrap();
    assert_eq!(v["kind"], "derived");
    assert_eq!(v["count"], 42);
    // data is base64-url encoded (no padding): 0xDE 0xAD -> "3q0"
    assert_eq!(v["data"], "3q0");
    // time is RFC 7231 formatted
    assert_eq!(v["time"], "Thu, 01 Jan 1970 00:00:00 GMT");
}
