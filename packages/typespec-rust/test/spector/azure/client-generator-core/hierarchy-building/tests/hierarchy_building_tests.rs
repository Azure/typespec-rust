// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_hierarchy_building::models::{Animal, Dog, Pet};
use spector_hierarchy_building::HierarchyBuildingClient;

#[tokio::test]
async fn update_dog_as_animal() {
    let client =
        HierarchyBuildingClient::with_no_credential("http://localhost:3000", None).unwrap();
    let dog = Dog {
        breed: Some("German Shepherd".to_string()),
        name: Some("Rex".to_string()),
        trained: Some(true),
    };
    let animal: Animal = dog.into();
    let resp = client
        .get_hierarchy_building_animal_operations_client()
        .update_dog_as_animal(animal.try_into().unwrap(), None)
        .await
        .unwrap();
    let value: Animal = resp.into_model().unwrap();
    match value {
        Animal::Dog(dog) => {
            assert_eq!(dog.name, Some("Rex".to_string()));
            assert_eq!(dog.trained, Some(true));
            assert_eq!(dog.breed, Some("German Shepherd".to_string()));
        }
        _ => panic!("Expected Animal::Dog"),
    }
}

#[tokio::test]
async fn update_dog_as_dog() {
    let client =
        HierarchyBuildingClient::with_no_credential("http://localhost:3000", None).unwrap();
    let dog = Dog {
        breed: Some("German Shepherd".to_string()),
        name: Some("Rex".to_string()),
        trained: Some(true),
    };
    let resp = client
        .get_hierarchy_building_dog_operations_client()
        .update_dog_as_dog(dog.try_into().unwrap(), None)
        .await
        .unwrap();
    let value: Dog = resp.into_model().unwrap();
    assert_eq!(value.name, Some("Rex".to_string()));
    assert_eq!(value.trained, Some(true));
    assert_eq!(value.breed, Some("German Shepherd".to_string()));
}

#[tokio::test]
async fn update_dog_as_pet() {
    let client =
        HierarchyBuildingClient::with_no_credential("http://localhost:3000", None).unwrap();
    let dog = Dog {
        breed: Some("German Shepherd".to_string()),
        name: Some("Rex".to_string()),
        trained: Some(true),
    };
    let pet: Pet = dog.into();
    let resp = client
        .get_hierarchy_building_pet_operations_client()
        .update_dog_as_pet(pet.try_into().unwrap(), None)
        .await
        .unwrap();
    let value: Pet = resp.into_model().unwrap();
    match value {
        Pet::Dog(dog) => {
            assert_eq!(dog.name, Some("Rex".to_string()));
            assert_eq!(dog.trained, Some(true));
            assert_eq!(dog.breed, Some("German Shepherd".to_string()));
        }
        _ => panic!("Expected Pet::Dog"),
    }
}

#[tokio::test]
async fn update_pet_as_animal() {
    let client =
        HierarchyBuildingClient::with_no_credential("http://localhost:3000", None).unwrap();
    let pet = Pet::UnknownKind {
        kind: Some("pet".to_string()),
        trained: Some(true),
        name: Some("Buddy".to_string()),
    };
    let animal: Animal = pet.into();
    let resp = client
        .get_hierarchy_building_animal_operations_client()
        .update_pet_as_animal(animal.try_into().unwrap(), None)
        .await
        .unwrap();
    let value: Animal = resp.into_model().unwrap();
    match value {
        Animal::Pet(pet) => match pet {
            Pet::UnknownKind { trained, name, .. } => {
                assert_eq!(trained, Some(true));
                assert_eq!(name, Some("Buddy".to_string()));
            }
            _ => panic!("Expected Pet::UnknownKind"),
        },
        _ => panic!("Expected Animal::Pet"),
    }
}

#[tokio::test]
async fn update_pet_as_pet() {
    let client =
        HierarchyBuildingClient::with_no_credential("http://localhost:3000", None).unwrap();
    let pet = Pet::UnknownKind {
        kind: Some("pet".to_string()),
        trained: Some(true),
        name: Some("Buddy".to_string()),
    };
    let resp = client
        .get_hierarchy_building_pet_operations_client()
        .update_pet_as_pet(pet.try_into().unwrap(), None)
        .await
        .unwrap();
    let value: Pet = resp.into_model().unwrap();
    match value {
        Pet::UnknownKind { trained, name, .. } => {
            assert_eq!(trained, Some(true));
            assert_eq!(name, Some("Buddy".to_string()));
        }
        _ => panic!("Expected Pet::UnknownKind"),
    }
}
