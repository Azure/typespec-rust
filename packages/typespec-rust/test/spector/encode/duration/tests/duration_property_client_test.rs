// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_duration::{
    models::{
        DefaultDurationProperty, Float64MillisecondsDurationProperty,
        Float64SecondsDurationProperty, FloatMillisecondsDurationArrayProperty,
        FloatMillisecondsDurationProperty, FloatSecondsDurationArrayProperty,
        FloatSecondsDurationProperty, ISO8601DurationProperty, Int32MillisecondsDurationProperty,
        Int32SecondsDurationProperty,
    },
    DurationClient,
};

#[tokio::test]
async fn default() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = DefaultDurationProperty {
        value: Some("P40D".to_string()),
    };
    let resp = client
        .get_duration_property_client()
        .default(body.try_into().unwrap(), None)
        .await
        .unwrap();
    let result: DefaultDurationProperty = resp.into_model().unwrap();
    assert_eq!(result.value, Some("P40D".to_string()));
}

#[tokio::test]
async fn float64_milliseconds() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Float64MillisecondsDurationProperty {
        value: Some(35625.0),
    };
    let resp = client
        .get_duration_property_client()
        .float64_milliseconds(body.try_into().unwrap(), None)
        .await
        .unwrap();
    let result: Float64MillisecondsDurationProperty = resp.into_model().unwrap();
    assert_eq!(result.value, Some(35625.0));
}

#[tokio::test]
async fn float64_seconds() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Float64SecondsDurationProperty {
        value: Some(35.625),
    };
    let resp = client
        .get_duration_property_client()
        .float64_seconds(body.try_into().unwrap(), None)
        .await
        .unwrap();
    let result: Float64SecondsDurationProperty = resp.into_model().unwrap();
    assert_eq!(result.value, Some(35.625));
}

#[tokio::test]
async fn float_milliseconds() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = FloatMillisecondsDurationProperty {
        value: Some(35625.0),
    };
    let resp = client
        .get_duration_property_client()
        .float_milliseconds(body.try_into().unwrap(), None)
        .await
        .unwrap();
    let result: FloatMillisecondsDurationProperty = resp.into_model().unwrap();
    assert_eq!(result.value, Some(35625.0));
}

#[tokio::test]
async fn float_milliseconds_array() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = FloatMillisecondsDurationArrayProperty {
        value: Some(vec![35625.0, 46750.0]),
    };
    let resp = client
        .get_duration_property_client()
        .float_milliseconds_array(body.try_into().unwrap(), None)
        .await
        .unwrap();
    let result: FloatMillisecondsDurationArrayProperty = resp.into_model().unwrap();
    assert_eq!(result.value, Some(vec![35625.0, 46750.0]));
}

#[tokio::test]
async fn float_seconds() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = FloatSecondsDurationProperty {
        value: Some(35.625),
    };
    let resp = client
        .get_duration_property_client()
        .float_seconds(body.try_into().unwrap(), None)
        .await
        .unwrap();
    let result: FloatSecondsDurationProperty = resp.into_model().unwrap();
    assert_eq!(result.value, Some(35.625));
}

#[tokio::test]
async fn float_seconds_array() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = FloatSecondsDurationArrayProperty {
        value: Some(vec![35.625, 46.75]),
    };
    let resp = client
        .get_duration_property_client()
        .float_seconds_array(body.try_into().unwrap(), None)
        .await
        .unwrap();
    let result: FloatSecondsDurationArrayProperty = resp.into_model().unwrap();
    assert_eq!(result.value, Some(vec![35.625, 46.75]));
}

#[tokio::test]
async fn int32_milliseconds() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Int32MillisecondsDurationProperty { value: Some(36000) };
    let resp = client
        .get_duration_property_client()
        .int32_milliseconds(body.try_into().unwrap(), None)
        .await
        .unwrap();
    let result: Int32MillisecondsDurationProperty = resp.into_model().unwrap();
    assert_eq!(result.value, Some(36000));
}

#[tokio::test]
async fn int32_seconds() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = Int32SecondsDurationProperty { value: Some(36) };
    let resp = client
        .get_duration_property_client()
        .int32_seconds(body.try_into().unwrap(), None)
        .await
        .unwrap();
    let result: Int32SecondsDurationProperty = resp.into_model().unwrap();
    assert_eq!(result.value, Some(36));
}

#[tokio::test]
async fn iso8601() {
    let client = DurationClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = ISO8601DurationProperty {
        value: Some("P40D".to_string()),
    };
    let resp = client
        .get_duration_property_client()
        .iso8601(body.try_into().unwrap(), None)
        .await
        .unwrap();
    let result: ISO8601DurationProperty = resp.into_model().unwrap();
    assert_eq!(result.value, Some("P40D".to_string()));
}
