// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_routes::RoutesClient;

use std::collections::HashMap;

#[tokio::test]
async fn fixed() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client.fixed(None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn in_interface_fixed() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_in_interface_client();

    let resp = client.fixed(None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_template_only() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client();

    let resp = client.template_only("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_explicit() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client();

    let resp = client.explicit("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_annotation_only() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client();

    let resp = client.annotation_only("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_reserved_expansion_template() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_reserved_expansion_client();

    let resp = client.template("bar baz", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_reserved_expansion_annotation() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_reserved_expansion_client();

    let resp = client.annotation("bar baz", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_simple_standard_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_simple_expansion_client()
        .get_routes_path_parameters_simple_expansion_standard_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_simple_standard_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_simple_expansion_client()
        .get_routes_path_parameters_simple_expansion_standard_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_simple_standard_record() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_simple_expansion_client()
        .get_routes_path_parameters_simple_expansion_standard_client();

    let resp = client.record(HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]), None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_simple_explode_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_simple_expansion_client()
        .get_routes_path_parameters_simple_expansion_explode_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_simple_explode_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_simple_expansion_client()
        .get_routes_path_parameters_simple_expansion_explode_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_simple_explode_record() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_simple_expansion_client()
        .get_routes_path_parameters_simple_expansion_explode_client();

    let resp = client.record(HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]), None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_path_standard_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_path_expansion_client()
        .get_routes_path_parameters_path_expansion_standard_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_path_standard_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_path_expansion_client()
        .get_routes_path_parameters_path_expansion_standard_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_path_standard_record() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_path_expansion_client()
        .get_routes_path_parameters_path_expansion_standard_client();

    let resp = client.record(HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]), None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_path_explode_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_path_expansion_client()
        .get_routes_path_parameters_path_expansion_explode_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_path_explode_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_path_expansion_client()
        .get_routes_path_parameters_path_expansion_explode_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_path_explode_record() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_path_expansion_client()
        .get_routes_path_parameters_path_expansion_explode_client();

    let resp = client.record(HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]), None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_label_standard_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_label_expansion_client()
        .get_routes_path_parameters_label_expansion_standard_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_label_standard_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_label_expansion_client()
        .get_routes_path_parameters_label_expansion_standard_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_label_standard_record() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_label_expansion_client()
        .get_routes_path_parameters_label_expansion_standard_client();

    let resp = client.record(HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]), None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_label_explode_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_label_expansion_client()
        .get_routes_path_parameters_label_expansion_explode_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_label_explode_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_label_expansion_client()
        .get_routes_path_parameters_label_expansion_explode_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_label_explode_record() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_label_expansion_client()
        .get_routes_path_parameters_label_expansion_explode_client();

    let resp = client.record(HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]), None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_matrix_standard_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_matrix_expansion_client()
        .get_routes_path_parameters_matrix_expansion_standard_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_matrix_standard_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_matrix_expansion_client()
        .get_routes_path_parameters_matrix_expansion_standard_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_matrix_standard_record() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_matrix_expansion_client()
        .get_routes_path_parameters_matrix_expansion_standard_client();

    let resp = client.record(HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]), None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_matrix_explode_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_matrix_expansion_client()
        .get_routes_path_parameters_matrix_expansion_explode_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_matrix_explode_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_matrix_expansion_client()
        .get_routes_path_parameters_matrix_expansion_explode_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_matrix_explode_record() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_matrix_expansion_client()
        .get_routes_path_parameters_matrix_expansion_explode_client();

    let resp = client.record(HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]), None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_template_only() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_query_parameters_client();

    let resp = client.template_only("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_explicit() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_query_parameters_client();

    let resp = client.explicit("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_annotation_only() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_query_parameters_client();

    let resp = client.annotation_only("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_expansion_standard_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_expansion_client()
        .get_routes_query_parameters_query_expansion_standard_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_expansion_standard_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_expansion_client()
        .get_routes_query_parameters_query_expansion_standard_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_expansion_standard_record() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_expansion_client()
        .get_routes_query_parameters_query_expansion_standard_client();

    let resp = client.record(HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]), None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_expansion_explode_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_expansion_client()
        .get_routes_query_parameters_query_expansion_explode_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_expansion_explode_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_expansion_client()
        .get_routes_query_parameters_query_expansion_explode_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_expansion_explode_record() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_expansion_client()
        .get_routes_query_parameters_query_expansion_explode_client();

    let resp = client.record(HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]), None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_continuation_standard_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_continuation_client()
        .get_routes_query_parameters_query_continuation_standard_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_continuation_standard_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_continuation_client()
        .get_routes_query_parameters_query_continuation_standard_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_continuation_standard_record() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_continuation_client()
        .get_routes_query_parameters_query_continuation_standard_client();

    let resp = client.record(HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]), None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_continuation_explode_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_continuation_client()
        .get_routes_query_parameters_query_continuation_explode_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_continuation_explode_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_continuation_client()
        .get_routes_query_parameters_query_continuation_explode_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_continuation_explode_record() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None).unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_continuation_client()
        .get_routes_query_parameters_query_continuation_explode_client();

    let resp = client.record(HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]), None).await.unwrap();
    assert_eq!(resp.status(), 204);
}
