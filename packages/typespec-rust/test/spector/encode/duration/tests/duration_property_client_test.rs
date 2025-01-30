// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_duration::{
    models::{
        DefaultDurationProperty, Float64SecondsDurationProperty, FloatSecondsDurationArrayProperty,
        FloatSecondsDurationProperty, ISO8601DurationProperty, Int32SecondsDurationProperty,
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
    let result: DefaultDurationProperty = resp.into_body().await.unwrap();
    assert_eq!(result.value, Some("P40D".to_string()));
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
    let result: Float64SecondsDurationProperty = resp.into_body().await.unwrap();
    assert_eq!(result.value, Some(35.625));
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
    let result: FloatSecondsDurationProperty = resp.into_body().await.unwrap();
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
    let result: FloatSecondsDurationArrayProperty = resp.into_body().await.unwrap();
    assert_eq!(result.value, Some(vec![35.625, 46.75]));
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
    let result: Int32SecondsDurationProperty = resp.into_body().await.unwrap();
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
    let result: ISO8601DurationProperty = resp.into_body().await.unwrap();
    assert_eq!(result.value, Some("P40D".to_string()));
}
