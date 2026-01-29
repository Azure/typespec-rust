// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_singledisc::{
    models::{Bird, Dinosaur, Eagle, Goose, SeaGull, Sparrow},
    SingleDiscriminatorClient,
};
use std::collections::HashMap;

#[tokio::test]
async fn get_legacy_model() {
    let client =
        SingleDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();

    let resp = client.get_legacy_model(None).await.unwrap();
    assert_eq!(resp.status(), 200);

    match resp.into_model().unwrap() {
        Dinosaur::TRex(t_rex) => {
            assert_eq!(t_rex.size, Some(20));
        }
        other => panic!("expected base TRex, found {other:?}"),
    }
}

#[tokio::test]
async fn get_missing_discriminator() {
    let client =
        SingleDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();

    let resp = client.get_missing_discriminator(None).await.unwrap();
    assert_eq!(resp.status(), 200);
    match resp.into_model().unwrap() {
        Bird::UnknownKind { kind, wingspan } => {
            assert!(kind.is_none());
            assert_eq!(wingspan, Some(1));
        }
        other => panic!("expected base Bird, found {other:?}"),
    }
}

#[tokio::test]
async fn get_model() {
    let client =
        SingleDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();

    let resp = client.get_model(None).await.unwrap();
    assert_eq!(resp.status(), 200);

    match resp.into_model().unwrap() {
        Bird::Sparrow(sparrow) => {
            assert_eq!(sparrow.wingspan, Some(1));
        }
        other => panic!("expected Sparrow, found {other:?}"),
    }
}

#[tokio::test]
async fn get_recursive_model() {
    let client =
        SingleDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();

    let resp = client.get_recursive_model(None).await.unwrap();
    assert_eq!(resp.status(), 200);

    match resp.into_model().unwrap() {
        Bird::Eagle(eagle) => {
            assert_eq!(eagle.wingspan, Some(5));

            let partner = eagle.partner.expect("expected partner");
            match *partner {
                Bird::Goose(goose) => {
                    assert_eq!(goose.wingspan, Some(2));
                }
                other => panic!("expected Goose partner, found {other:?}"),
            }

            let friends = eagle.friends.expect("expected friends");
            assert_eq!(friends.len(), 1);
            match &friends[0] {
                Bird::SeaGull(seagull) => assert_eq!(seagull.wingspan, Some(2)),
                other => panic!("expected SeaGull friend, found {other:?}"),
            }

            let hate = eagle.hate.expect("expected hate map");
            let foe = hate.get("key3").expect("expected key3 entry");
            match foe {
                Bird::Sparrow(sparrow) => assert_eq!(sparrow.wingspan, Some(1)),
                other => panic!("expected Sparrow foe, found {other:?}"),
            }
        }
        other => panic!("expected Eagle, found {other:?}"),
    }
}

#[tokio::test]
async fn get_wrong_discriminator() {
    let client =
        SingleDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();

    let resp = client.get_wrong_discriminator(None).await.unwrap();
    assert_eq!(resp.status(), 200);
    match resp.into_model().unwrap() {
        Bird::UnknownKind { kind, wingspan } => {
            assert_eq!(kind, Some("wrongKind".to_string()));
            assert_eq!(wingspan, Some(1));
        }
        other => panic!("expected base Bird, found {other:?}"),
    }
}

#[tokio::test]
async fn put_model() {
    let client =
        SingleDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();

    let body = Sparrow { wingspan: Some(1) };

    let resp = client
        .put_model(Bird::from(body).try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn put_recursive_model() {
    let client =
        SingleDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();

    let mut hate = HashMap::new();
    hate.insert(
        "key3".to_string(),
        Bird::Sparrow(Sparrow { wingspan: Some(1) }),
    );

    let body = Eagle {
        wingspan: Some(5),
        partner: Some(Box::new(Bird::Goose(Goose { wingspan: Some(2) }))),
        friends: Some(vec![Bird::SeaGull(SeaGull { wingspan: Some(2) })]),
        hate: Some(hate),
    };

    let resp = client
        .put_recursive_model(Bird::from(body).try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}
