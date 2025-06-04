// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_singledisc::{models::{BirdKind, DinosaurKind}, SingleDiscriminatorClient};

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

#[tokio::test]
async fn get_missing_discriminator() {
    let client =
        SingleDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_missing_discriminator(None)
        .await
        .unwrap()
        .into_body()
        .await;
    // TODO: should this fall back to the base type like in Go?
    assert!(resp.is_err());
}

#[tokio::test]
async fn get_model() {
    let client =
        SingleDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_model(None)
        .await
        .unwrap()
        .into_body()
        .await
        .unwrap();
    match resp {
        BirdKind::Sparrow(resp) => {
            assert_eq!(resp.wingspan, Some(1));
        }
        _ => panic!("unexpected bird kind")
    }
}

#[tokio::test]
async fn get_recursive_model() {}

#[tokio::test]
async fn get_wrong_discriminator() {
    let client =
        SingleDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_wrong_discriminator(None)
        .await
        .unwrap()
        .into_body()
        .await.unwrap();
    // TODO: this is the unknown case. this SHOULD fall back to the base kind and/or expose the raw JSON
    //assert!(resp.is_err());
}

#[tokio::test]
async fn put_model() {}

#[tokio::test]
async fn put_recursive_model() {}
