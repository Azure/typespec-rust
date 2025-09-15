// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use azure_core::http::RequestContent;
use spector_coremodel::{models::AzureEmbeddingModel, ModelClient};

#[tokio::test]
async fn get_embedding_vector() {
    let client = ModelClient::with_no_credential("http://localhost:3000", None).unwrap();
    let resp = client
        .get_model_azure_core_embedding_vector_client()
        .get(None)
        .await
        .unwrap();
    let embedding_vector: Vec<i32> = resp.into_body().await.unwrap();
    assert_eq!(embedding_vector, vec![0, 1, 2, 3, 4]);
}

#[tokio::test]
async fn put_embedding_vector() {
    let client = ModelClient::with_no_credential("http://localhost:3000", None).unwrap();
    let body = RequestContent::try_from(vec![0, 1, 2, 3, 4]).unwrap();
    client
        .get_model_azure_core_embedding_vector_client()
        .put(body, None)
        .await
        .unwrap();
}

#[tokio::test]
async fn post_azure_embedding_model() {
    let client = ModelClient::with_no_credential("http://localhost:3000", None).unwrap();
    let input_model = AzureEmbeddingModel {
        embedding: Some(vec![0, 1, 2, 3, 4]),
    };
    let body = RequestContent::try_from(input_model).unwrap();
    let resp = client
        .get_model_azure_core_embedding_vector_client()
        .post(body, None)
        .await
        .unwrap();
    let response_model: AzureEmbeddingModel = resp.into_body().await.unwrap();
    assert_eq!(response_model.embedding, Some(vec![5, 6, 7, 8, 9]));
}
