// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_query::QueryClient;

#[tokio::test]
async fn special_char_subclient_inherits_endpoint() {
    let client = QueryClient::with_no_credential("http://localhost:3000", None).unwrap();
    let subclient = client.get_query_special_char_client();
    assert_eq!(subclient.endpoint().as_str(), "http://localhost:3000/");
}

// The upstream http-specs `mockapi.ts` registers the route as
// `/parameters/query/special-char/dollar-sign` (kebab-case) while the tsp
// (and therefore the generated client) uses `@route("/dollarSign")`
// (camelCase). The spector mock server returns 404 until that mismatch is
// fixed upstream, so this live test is ignored for now.
#[ignore = "upstream http-specs path mismatch: dollarSign vs dollar-sign"]
#[tokio::test]
async fn dollar_sign_returns_204() {
    let client = QueryClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_query_special_char_client()
        .dollar_sign("status eq 'active'", None)
        .await
        .unwrap();
    assert_eq!(
        resp.status(),
        204,
        "dollar_sign with $filter query param should return 204 No Content"
    );
}
