// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use spector_azure_client_namespace::second::sub::models::SecondClientEnumType;
use spector_azure_client_namespace::second::ClientNamespaceSecondClient;

#[tokio::test]
async fn client_namespace_second() {
    let client =
        ClientNamespaceSecondClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client.get_second(None).await.unwrap();
    let result = resp.into_model().unwrap();
    assert_eq!(result.type_prop, Some(SecondClientEnumType::Second));
}
