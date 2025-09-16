// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_union_discriminated::DiscriminatedClient;

#[tokio::test]
async fn envelope_default_get() {
    let client = DiscriminatedClient::with_no_credential("http://localhost:3000", None).unwrap();
    client
        .get_discriminated_envelope_client()
        .get_discriminated_envelope_object_client()
        .get_discriminated_envelope_object_default_client()
        .get(None)
        .await
        .unwrap();
}
