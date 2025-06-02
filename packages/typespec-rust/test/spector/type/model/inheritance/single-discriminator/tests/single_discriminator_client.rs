// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_singledisc::{models::DinosaurKind, SingleDiscriminatorClient};

#[tokio::test]
async fn get_legacy_model() {
    let client =
        SingleDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_legacy_model(None)
        .await
        .unwrap()
        .into_body()
        .await
        .unwrap();
    match resp {
        DinosaurKind::TRex(resp) => {
            //assert_eq!(resp.kind, Some("t-rex".to_string()));
            assert_eq!(resp.size, Some(20));
        }
        _ => panic!("unexpected dinosaur kind"),
    }
}
