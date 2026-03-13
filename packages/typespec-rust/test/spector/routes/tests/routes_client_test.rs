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
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_in_interface_client();

    let resp = client.fixed(None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_template_only() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client();

    let resp = client.template_only("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_explicit() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client();

    let resp = client.explicit("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_annotation_only() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client();

    let resp = client.annotation_only("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_reserved_expansion_template() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_reserved_expansion_client();

    let resp = client.template("foo/bar baz", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_reserved_expansion_annotation() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_reserved_expansion_client();

    let resp = client.annotation("foo/bar baz", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_simple_standard_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_simple_expansion_client()
        .get_routes_path_parameters_simple_expansion_standard_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_simple_standard_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_simple_expansion_client()
        .get_routes_path_parameters_simple_expansion_standard_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_simple_explode_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_simple_expansion_client()
        .get_routes_path_parameters_simple_expansion_explode_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_simple_explode_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_simple_expansion_client()
        .get_routes_path_parameters_simple_expansion_explode_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_path_standard_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_path_expansion_client()
        .get_routes_path_parameters_path_expansion_standard_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_path_standard_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_path_expansion_client()
        .get_routes_path_parameters_path_expansion_standard_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_path_explode_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_path_expansion_client()
        .get_routes_path_parameters_path_expansion_explode_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_path_explode_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_path_expansion_client()
        .get_routes_path_parameters_path_expansion_explode_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_label_standard_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_label_expansion_client()
        .get_routes_path_parameters_label_expansion_standard_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_label_standard_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_label_expansion_client()
        .get_routes_path_parameters_label_expansion_standard_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_label_explode_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_label_expansion_client()
        .get_routes_path_parameters_label_expansion_explode_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_label_explode_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_label_expansion_client()
        .get_routes_path_parameters_label_expansion_explode_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_matrix_standard_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_matrix_expansion_client()
        .get_routes_path_parameters_matrix_expansion_standard_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_matrix_standard_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_matrix_expansion_client()
        .get_routes_path_parameters_matrix_expansion_standard_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_matrix_explode_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_matrix_expansion_client()
        .get_routes_path_parameters_matrix_expansion_explode_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_matrix_explode_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_path_parameters_client()
        .get_routes_path_parameters_matrix_expansion_client()
        .get_routes_path_parameters_matrix_expansion_explode_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_template_only() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_query_parameters_client();

    let resp = client.template_only("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_explicit() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_query_parameters_client();

    let resp = client.explicit("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_annotation_only() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_query_parameters_client();

    let resp = client.annotation_only("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_expansion_standard_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_expansion_client()
        .get_routes_query_parameters_query_expansion_standard_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_expansion_standard_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_expansion_client()
        .get_routes_query_parameters_query_expansion_standard_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_expansion_explode_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_expansion_client()
        .get_routes_query_parameters_query_expansion_explode_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_expansion_explode_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_expansion_client()
        .get_routes_query_parameters_query_expansion_explode_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_continuation_standard_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_continuation_client()
        .get_routes_query_parameters_query_continuation_standard_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_continuation_standard_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_continuation_client()
        .get_routes_query_parameters_query_continuation_standard_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_continuation_explode_primitive() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_continuation_client()
        .get_routes_query_parameters_query_continuation_explode_client();

    let resp = client.primitive("a", None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_continuation_explode_array() {
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_continuation_client()
        .get_routes_query_parameters_query_continuation_explode_client();

    let resp = client.array(&["a", "b"], None).await.unwrap();
    assert_eq!(resp.status(), 204);
}

// Spector does not handle reordered hashmaps. Other SDKs did not run into this problem.
// It would be more expensive to fix this at the spector side. Something can be fone for query parameters at the scope
// of a specific mockapi.ts for query parameters.
// But for path parameters, the whole test infrastructure needs to be updated, so that it would listen on two URLs (i.e.
// with path containing "a,1,b,2" and "b,2,a,1"), and would mark the test as passed if only one of the URLs were hit.
// That would me more expensive update, and it looks like only Rust would benefit from it.
// So instead of doing that, we would use the client policy below when testing HashMaps as query and path parameters.
// When used responsively as we do (i.e. only to flip "b,2,a,1" into "a,1,b,2"), it will not mask any real code issue.
#[derive(Clone, Debug)]
struct UrlUpdatePolicy {
    from_url: String,
    to_url: String,
}

impl UrlUpdatePolicy {
    fn new(from_url: String, to_url: String) -> Self {
        Self { from_url, to_url }
    }
}

#[async_trait::async_trait]
impl azure_core::http::policies::Policy for UrlUpdatePolicy {
    async fn send(
        &self,
        ctx: &azure_core::http::Context,
        request: &mut azure_core::http::Request,
        next: &[std::sync::Arc<dyn azure_core::http::policies::Policy>],
    ) -> azure_core::http::policies::PolicyResult {
        if request.url().to_string() == self.from_url {
            *request.url_mut() = azure_core::http::Url::parse(self.to_url.as_str()).unwrap();
        }

        if request.url().to_string() != self.to_url {
            // We expect Spector to pass if the request URL matches the to_url.
            // If this is not happening, then it's for one of 3 reasons:
            // 1. Codegen could be generating the wrong URL, Spector would've failed. Fix the codegen.
            // 2. The URL is correct, Spector was updated, the substitute URLs in the test need to be updated.
            // 3. You are just writing the test, and it never has passed before. Put the correct substitute URLs in the test.
            //
            // The reason we do this check here is for consistency - so that we know that the test will either pass each time,
            // or fail each time. Otherwise, substitute URL could've been wrong, but the test would pass a coule of times if
            // the sort gives the right order, and it would start failing inconsistently.
            //
            // We either consistently fail, or consistently pass, every time,
            // regardless of whether the URL really needed modification or not.
            return Err(azure_core::Error::with_message(
                azure_core::error::ErrorKind::Other,
                format!(
                    "Unexpected request URL.  Actual: {}  Expected: {}",
                    request.url(),
                    self.to_url
                ),
            ));
        }

        next[0].send(ctx, request, &next[1..]).await
    }
}

#[tokio::test]
async fn path_simple_standard_record() {
    let client = RoutesClient::with_no_credential(
        "http://localhost:3000",
        Some(spector_routes::RoutesClientOptions {
            client_options: azure_core::http::ClientOptions {
                per_call_policies: vec![std::sync::Arc::new(UrlUpdatePolicy::new(
                    "http://localhost:3000/routes/path/simple/standard/recordb,2,a,1".to_string(),
                    "http://localhost:3000/routes/path/simple/standard/recorda,1,b,2".to_string(),
                ))],
                ..Default::default()
            },
        }),
    )
    .unwrap()
    .get_routes_path_parameters_client()
    .get_routes_path_parameters_simple_expansion_client()
    .get_routes_path_parameters_simple_expansion_standard_client();

    let resp = client
        .record(
            &HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]),
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_simple_explode_record() {
    let client = RoutesClient::with_no_credential(
        "http://localhost:3000",
        Some(spector_routes::RoutesClientOptions {
            client_options: azure_core::http::ClientOptions {
                per_call_policies: vec![std::sync::Arc::new(UrlUpdatePolicy::new(
                    "http://localhost:3000/routes/path/simple/explode/recordb=2,a=1".to_string(),
                    "http://localhost:3000/routes/path/simple/explode/recorda=1,b=2".to_string(),
                ))],
                ..Default::default()
            },
        }),
    )
    .unwrap()
    .get_routes_path_parameters_client()
    .get_routes_path_parameters_simple_expansion_client()
    .get_routes_path_parameters_simple_expansion_explode_client();

    let resp = client
        .record(
            &HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]),
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_path_standard_record() {
    let client = RoutesClient::with_no_credential(
        "http://localhost:3000",
        Some(spector_routes::RoutesClientOptions {
            client_options: azure_core::http::ClientOptions {
                per_call_policies: vec![std::sync::Arc::new(UrlUpdatePolicy::new(
                    "http://localhost:3000/routes/path/path/standard/record/b,2,a,1".to_string(),
                    "http://localhost:3000/routes/path/path/standard/record/a,1,b,2".to_string(),
                ))],
                ..Default::default()
            },
        }),
    )
    .unwrap()
    .get_routes_path_parameters_client()
    .get_routes_path_parameters_path_expansion_client()
    .get_routes_path_parameters_path_expansion_standard_client();

    let resp = client
        .record(
            &HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]),
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_path_explode_record() {
    let client = RoutesClient::with_no_credential(
        "http://localhost:3000",
        Some(spector_routes::RoutesClientOptions {
            client_options: azure_core::http::ClientOptions {
                per_call_policies: vec![std::sync::Arc::new(UrlUpdatePolicy::new(
                    "http://localhost:3000/routes/path/path/explode/record/b=2/a=1".to_string(),
                    "http://localhost:3000/routes/path/path/explode/record/a=1/b=2".to_string(),
                ))],
                ..Default::default()
            },
        }),
    )
    .unwrap()
    .get_routes_path_parameters_client()
    .get_routes_path_parameters_path_expansion_client()
    .get_routes_path_parameters_path_expansion_explode_client();

    let resp = client
        .record(
            &HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]),
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_label_standard_record() {
    let client = RoutesClient::with_no_credential(
        "http://localhost:3000",
        Some(spector_routes::RoutesClientOptions {
            client_options: azure_core::http::ClientOptions {
                per_call_policies: vec![std::sync::Arc::new(UrlUpdatePolicy::new(
                    "http://localhost:3000/routes/path/label/standard/record.b,2,a,1".to_string(),
                    "http://localhost:3000/routes/path/label/standard/record.a,1,b,2".to_string(),
                ))],
                ..Default::default()
            },
        }),
    )
    .unwrap()
    .get_routes_path_parameters_client()
    .get_routes_path_parameters_label_expansion_client()
    .get_routes_path_parameters_label_expansion_standard_client();

    let resp = client
        .record(
            &HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]),
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_label_explode_record() {
    let client = RoutesClient::with_no_credential(
        "http://localhost:3000",
        Some(spector_routes::RoutesClientOptions {
            client_options: azure_core::http::ClientOptions {
                per_call_policies: vec![std::sync::Arc::new(UrlUpdatePolicy::new(
                    "http://localhost:3000/routes/path/label/explode/record.b=2.a=1".to_string(),
                    "http://localhost:3000/routes/path/label/explode/record.a=1.b=2".to_string(),
                ))],
                ..Default::default()
            },
        }),
    )
    .unwrap()
    .get_routes_path_parameters_client()
    .get_routes_path_parameters_label_expansion_client()
    .get_routes_path_parameters_label_expansion_explode_client();

    let resp = client
        .record(
            &HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]),
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_matrix_standard_record() {
    let client = RoutesClient::with_no_credential(
        "http://localhost:3000",
        Some(spector_routes::RoutesClientOptions {
            client_options: azure_core::http::ClientOptions {
                per_call_policies: vec![std::sync::Arc::new(UrlUpdatePolicy::new(
                    "http://localhost:3000/routes/path/matrix/standard/record;param=b,2,a,1"
                        .to_string(),
                    "http://localhost:3000/routes/path/matrix/standard/record;param=a,1,b,2"
                        .to_string(),
                ))],
                ..Default::default()
            },
        }),
    )
    .unwrap()
    .get_routes_path_parameters_client()
    .get_routes_path_parameters_matrix_expansion_client()
    .get_routes_path_parameters_matrix_expansion_standard_client();

    let resp = client
        .record(
            &HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]),
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn path_matrix_explode_record() {
    let client = RoutesClient::with_no_credential(
        "http://localhost:3000",
        Some(spector_routes::RoutesClientOptions {
            client_options: azure_core::http::ClientOptions {
                per_call_policies: vec![std::sync::Arc::new(UrlUpdatePolicy::new(
                    "http://localhost:3000/routes/path/matrix/explode/record;b=2;a=1".to_string(),
                    "http://localhost:3000/routes/path/matrix/explode/record;a=1;b=2".to_string(),
                ))],
                ..Default::default()
            },
        }),
    )
    .unwrap()
    .get_routes_path_parameters_client()
    .get_routes_path_parameters_matrix_expansion_client()
    .get_routes_path_parameters_matrix_expansion_explode_client();

    let resp = client
        .record(
            &HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]),
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_expansion_standard_record() {
    let client = RoutesClient::with_no_credential("http://localhost:3000",
            Some(spector_routes::RoutesClientOptions {
                client_options: azure_core::http::ClientOptions {
                    per_call_policies: vec![std::sync::Arc::new(UrlUpdatePolicy::new(
                        "http://localhost:3000/routes/query/query-expansion/standard/record?param=b%2C2%2Ca%2C1".to_string(),
                        "http://localhost:3000/routes/query/query-expansion/standard/record?param=a%2C1%2Cb%2C2".to_string(),
                    ))],
                    ..Default::default()
                }
            }),
        )
        .unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_expansion_client()
        .get_routes_query_parameters_query_expansion_standard_client();

    let resp = client
        .record(
            &HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]),
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_expansion_explode_record() {
    // No need to use UrlUpdatePolicy, because the query parameters are put as "?a=1&b=2",
    // and Spector handles them in reverse order just as well.
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_expansion_client()
        .get_routes_query_parameters_query_expansion_explode_client();

    let resp = client
        .record(
            &HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]),
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_continuation_standard_record() {
    let client = RoutesClient::with_no_credential("http://localhost:3000",
            Some(spector_routes::RoutesClientOptions {
                client_options: azure_core::http::ClientOptions {
                    per_call_policies: vec![std::sync::Arc::new(UrlUpdatePolicy::new(
                        "http://localhost:3000/routes/query/query-continuation/standard/record?fixed=true&param=b%2C2%2Ca%2C1".to_string(),
                        "http://localhost:3000/routes/query/query-continuation/standard/record?fixed=true&param=a%2C1%2Cb%2C2".to_string(),
                    ))],
                    ..Default::default()
                }
            }),
        )
        .unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_continuation_client()
        .get_routes_query_parameters_query_continuation_standard_client();

    let resp = client
        .record(
            &HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]),
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn query_query_continuation_explode_record() {
    // No need to use UrlUpdatePolicy, because the query parameters are put as "&a=1&b=2",
    // and Spector handles them in reverse order just as well.
    let client = RoutesClient::with_no_credential("http://localhost:3000", None)
        .unwrap()
        .get_routes_query_parameters_client()
        .get_routes_query_parameters_query_continuation_client()
        .get_routes_query_parameters_query_continuation_explode_client();

    let resp = client
        .record(
            &HashMap::from([("a".to_string(), 1i32), ("b".to_string(), 2i32)]),
            None,
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), 204);
}
