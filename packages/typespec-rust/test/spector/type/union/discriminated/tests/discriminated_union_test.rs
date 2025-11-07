// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_union_discriminated::models::Cat;
use spector_union_discriminated::models::DiscriminatedEnvelopeObjectCustomPropertiesClientGetOptions;
use spector_union_discriminated::models::DiscriminatedEnvelopeObjectDefaultClientGetOptions;
use spector_union_discriminated::models::DiscriminatedNoEnvelopeCustomDiscriminatorClientGetOptions;
use spector_union_discriminated::models::DiscriminatedNoEnvelopeDefaultClientGetOptions;
use spector_union_discriminated::models::PetInline;
use spector_union_discriminated::models::PetInlineWithCustomDiscriminator;
use spector_union_discriminated::models::PetWithCustomNames;
use spector_union_discriminated::models::PetWithEnvelope;
use spector_union_discriminated::DiscriminatedClient;

#[tokio::test]
async fn no_envelope_default_put() {
    let cat = PetInline::Cat(Cat {
        name: Some(String::from("Whiskers")),
        meow: Some(true),
    });

    let client = DiscriminatedClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_discriminated_no_envelope_client()
        .get_discriminated_no_envelope_default_client()
        .put(cat.try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    let value: PetInline = resp.into_model().unwrap();
    match value {
        PetInline::Cat(cat) => {
            assert_eq!(cat.name, Some(String::from("Whiskers")));
            assert_eq!(cat.meow, Some(true));
        }
        _ => panic!("Expected a Cat"),
    }
}

#[tokio::test]
async fn no_envelope_custom_put() {
    let cat = PetInlineWithCustomDiscriminator::Cat(Cat {
        name: Some(String::from("Whiskers")),
        meow: Some(true),
    });

    let client = DiscriminatedClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_discriminated_no_envelope_client()
        .get_discriminated_no_envelope_custom_discriminator_client()
        .put(cat.try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    let value: PetInlineWithCustomDiscriminator = resp.into_model().unwrap();
    match value {
        PetInlineWithCustomDiscriminator::Cat(cat) => {
            assert_eq!(cat.name, Some(String::from("Whiskers")));
            assert_eq!(cat.meow, Some(true));
        }
        _ => panic!("Expected a Cat"),
    }
}

#[tokio::test]
async fn envelope_default_put() {
    let cat = PetWithEnvelope::Cat(Cat {
        name: Some(String::from("Whiskers")),
        meow: Some(true),
    });

    let client = DiscriminatedClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_discriminated_envelope_client()
        .get_discriminated_envelope_object_client()
        .get_discriminated_envelope_object_default_client()
        .put(cat.try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    let value: PetWithEnvelope = resp.into_model().unwrap();
    match value {
        PetWithEnvelope::Cat(cat) => {
            assert_eq!(cat.name, Some(String::from("Whiskers")));
            assert_eq!(cat.meow, Some(true));
        }
        _ => panic!("Expected a Cat"),
    }
}

#[tokio::test]
async fn envelope_custom_put() {
    let cat = PetWithCustomNames::Cat(Cat {
        name: Some(String::from("Whiskers")),
        meow: Some(true),
    });

    let client = DiscriminatedClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_discriminated_envelope_client()
        .get_discriminated_envelope_object_client()
        .get_discriminated_envelope_object_custom_properties_client()
        .put(cat.try_into().unwrap(), None)
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    let value: PetWithCustomNames = resp.into_model().unwrap();
    match value {
        PetWithCustomNames::Cat(cat) => {
            assert_eq!(cat.name, Some(String::from("Whiskers")));
            assert_eq!(cat.meow, Some(true));
        }
        _ => panic!("Expected a Cat"),
    }
}

#[tokio::test]
async fn no_envelope_default_get() {
    let client = DiscriminatedClient::with_no_credential("http://localhost:3000", None).unwrap();
    {
        let resp = client
            .get_discriminated_no_envelope_client()
            .get_discriminated_no_envelope_default_client()
            .get(None)
            .await
            .unwrap();

        let value: PetInline = resp.into_model().unwrap();
        match value {
            PetInline::Cat(cat) => {
                assert_eq!(cat.name, Some(String::from("Whiskers")));
                assert_eq!(cat.meow, Some(true));
            }
            _ => panic!("Expected a Cat"),
        }
    }
    {
        let resp = client
            .get_discriminated_no_envelope_client()
            .get_discriminated_no_envelope_default_client()
            .get(Some(DiscriminatedNoEnvelopeDefaultClientGetOptions {
                kind: Some(String::from("dog")),
                ..Default::default()
            }))
            .await
            .unwrap();

        let value: PetInline = resp.into_model().unwrap();
        match value {
            PetInline::Dog(dog) => {
                assert_eq!(dog.name, Some(String::from("Rex")));
                assert_eq!(dog.bark, Some(false));
            }
            _ => panic!("Expected a Dog"),
        }
    }
}

#[tokio::test]
async fn no_envelope_custom_get() {
    let client = DiscriminatedClient::with_no_credential("http://localhost:3000", None).unwrap();
    {
        let resp = client
            .get_discriminated_no_envelope_client()
            .get_discriminated_no_envelope_custom_discriminator_client()
            .get(None)
            .await
            .unwrap();

        let value: PetInlineWithCustomDiscriminator = resp.into_model().unwrap();
        match value {
            PetInlineWithCustomDiscriminator::Cat(cat) => {
                assert_eq!(cat.name, Some(String::from("Whiskers")));
                assert_eq!(cat.meow, Some(true));
            }
            _ => panic!("Expected a Cat"),
        }
    }
    {
        let resp = client
            .get_discriminated_no_envelope_client()
            .get_discriminated_no_envelope_custom_discriminator_client()
            .get(Some(
                DiscriminatedNoEnvelopeCustomDiscriminatorClientGetOptions {
                    type_param: Some(String::from("dog")),
                    ..Default::default()
                },
            ))
            .await
            .unwrap();

        let value: PetInlineWithCustomDiscriminator = resp.into_model().unwrap();
        match value {
            PetInlineWithCustomDiscriminator::Dog(dog) => {
                assert_eq!(dog.name, Some(String::from("Rex")));
                assert_eq!(dog.bark, Some(false));
            }
            _ => panic!("Expected a Dog"),
        }
    }
}

#[tokio::test]
async fn envelope_default_get() {
    let client = DiscriminatedClient::with_no_credential("http://localhost:3000", None).unwrap();
    {
        let resp = client
            .get_discriminated_envelope_client()
            .get_discriminated_envelope_object_client()
            .get_discriminated_envelope_object_default_client()
            .get(None)
            .await
            .unwrap();

        let value: PetWithEnvelope = resp.into_model().unwrap();
        match value {
            PetWithEnvelope::Cat(cat) => {
                assert_eq!(cat.name, Some(String::from("Whiskers")));
                assert_eq!(cat.meow, Some(true));
            }
            _ => panic!("Expected a Cat"),
        }
    }
    {
        let resp = client
            .get_discriminated_envelope_client()
            .get_discriminated_envelope_object_client()
            .get_discriminated_envelope_object_default_client()
            .get(Some(DiscriminatedEnvelopeObjectDefaultClientGetOptions {
                kind: Some(String::from("dog")),
                ..Default::default()
            }))
            .await
            .unwrap();

        let value: PetWithEnvelope = resp.into_model().unwrap();
        match value {
            PetWithEnvelope::Dog(dog) => {
                assert_eq!(dog.name, Some(String::from("Rex")));
                assert_eq!(dog.bark, Some(false));
            }
            _ => panic!("Expected a Dog"),
        }
    }
}

#[tokio::test]
async fn envelope_custom_get() {
    let client = DiscriminatedClient::with_no_credential("http://localhost:3000", None).unwrap();
    {
        let resp = client
            .get_discriminated_envelope_client()
            .get_discriminated_envelope_object_client()
            .get_discriminated_envelope_object_custom_properties_client()
            .get(None)
            .await
            .unwrap();

        let value: PetWithCustomNames = resp.into_model().unwrap();
        match value {
            PetWithCustomNames::Cat(cat) => {
                assert_eq!(cat.name, Some(String::from("Whiskers")));
                assert_eq!(cat.meow, Some(true));
            }
            _ => panic!("Expected a Cat"),
        }
    }
    {
        let resp = client
            .get_discriminated_envelope_client()
            .get_discriminated_envelope_object_client()
            .get_discriminated_envelope_object_custom_properties_client()
            .get(Some(
                DiscriminatedEnvelopeObjectCustomPropertiesClientGetOptions {
                    pet_type: Some(String::from("dog")),
                    ..Default::default()
                },
            ))
            .await
            .unwrap();

        let value: PetWithCustomNames = resp.into_model().unwrap();
        match value {
            PetWithCustomNames::Dog(dog) => {
                assert_eq!(dog.name, Some(String::from("Rex")));
                assert_eq!(dog.bark, Some(false));
            }
            _ => panic!("Expected a Dog"),
        }
    }
}
