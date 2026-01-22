// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_enumdisc::{
    models::{COLLIDES_DogKind_2, COLLIDES_SnakeKind_2, Cobra, Golden},
    EnumDiscriminatorClient,
};

#[tokio::test]
async fn get_extensible_model() {
    let client =
        EnumDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();

    let resp = client.get_extensible_model(None).await.unwrap();
    assert_eq!(resp.status(), 200);

    match resp.into_model().unwrap() {
        COLLIDES_DogKind_2::Golden(golden) => {
            assert_eq!(golden.weight, Some(10));
        }
        other => panic!("expected Golden, found {other:?}"),
    }
}

#[tokio::test]
async fn get_extensible_model_missing_discriminator() {
    let client =
        EnumDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();

    let resp = client
        .get_extensible_model_missing_discriminator(None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);

    match resp.into_model().unwrap() {
        COLLIDES_DogKind_2::Dog(dog) => {
            assert_eq!(dog.weight, Some(10));
        }
        other => panic!("expected base Dog, found {other:?}"),
    }
}

#[tokio::test]
async fn get_extensible_model_wrong_discriminator() {
    let client =
        EnumDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();

    let resp = client
        .get_extensible_model_wrong_discriminator(None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);

    match resp.into_model().unwrap() {
        COLLIDES_DogKind_2::Dog(dog) => {
            assert_eq!(dog.weight, Some(8));
        }
        other => panic!("expected base Dog, found {other:?}"),
    }
}

#[tokio::test]
async fn get_fixed_model() {
    let client =
        EnumDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();

    let resp = client.get_fixed_model(None).await.unwrap();
    assert_eq!(resp.status(), 200);

    match resp.into_model().unwrap() {
        COLLIDES_SnakeKind_2::Cobra(cobra) => {
            assert_eq!(cobra.length, Some(10));
        }
    }
}

#[tokio::test]
async fn get_fixed_model_missing_discriminator() {
    let client =
        EnumDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();

    let resp = client
        .get_fixed_model_missing_discriminator(None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);

    // Fixed enum requires a discriminator, so this should fail to deserialize
    let result = resp.into_model();
    let err = result.unwrap_err();
    assert!(err
        .to_string()
        .contains("missing discriminator field 'kind' for COLLIDES_SnakeKind_2"));
}

#[tokio::test]
async fn get_fixed_model_wrong_discriminator() {
    let client =
        EnumDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();

    let resp = client
        .get_fixed_model_wrong_discriminator(None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);

    // Fixed enum doesn't support unknown discriminator values
    // So this should fail to deserialize
    let result = resp.into_model();
    let err = result.unwrap_err();
    assert!(err
        .to_string()
        .contains("unknown variant of COLLIDES_SnakeKind_2 found: wrongKind"));
}

#[tokio::test]
async fn put_extensible_model() {
    let client =
        EnumDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();

    let body = COLLIDES_DogKind_2::Golden(Golden { weight: Some(10) });

    let resp = client
        .put_extensible_model(body.try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}

#[tokio::test]
async fn put_fixed_model() {
    let client =
        EnumDiscriminatorClient::with_no_credential("http://localhost:3000", None).unwrap();

    let body = COLLIDES_SnakeKind_2::Cobra(Cobra { length: Some(10) });

    let resp = client
        .put_fixed_model(body.try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 204);
}
