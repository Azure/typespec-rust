// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use spector_access::AccessClient;

// #[tokio::test]
// async fn internal_operation() {
//     let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
//     let client = client.get_access_internal_operation_client();

// We can enable the compilation of the block below via some emitter option to emit internal as public.
//     let resp = client
//         .no_decorator_in_internal("sample", None)
//         .await
//         .unwrap();
//     assert_eq!(resp.status(), 200);
//     let resp = resp.into_model().unwrap();
//     assert!(resp.name.is_some());
//     assert_eq!(resp.name.unwrap(), "sample".to_string());

// Same as above, we can enable the compilation of the block below via some emitter option to emit internal as public.
//     let resp = client
//         .internal_decorator_in_internal("sample", None)
//         .await
//         .unwrap();
//     assert_eq!(resp.status(), 200);
//     let resp = resp.into_model().unwrap();
//     assert!(resp.name.is_some());
//     assert_eq!(resp.name.unwrap(), "sample".to_string());

// The block below should compile without any emitter options. The fact that public_decorator_in_internal() is not exposed is rather a bug.
//     let resp = client
//         .public_decorator_in_internal("sample", None)
//         .await
//         .unwrap();
//     assert_eq!(resp.status(), 200);
//     let resp = resp.into_model().unwrap();
//     assert!(resp.name.is_some());
//     assert_eq!(resp.name.unwrap(), "sample".to_string());
// }

#[tokio::test]
async fn public_operation() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let client = client.get_access_public_operation_client();

    let resp = client.no_decorator_in_public("sample", None).await.unwrap();
    assert_eq!(resp.status(), 200);
    let resp = resp.into_model().unwrap();
    assert!(resp.name.is_some());
    assert_eq!(resp.name.unwrap(), "sample".to_string());

    let resp = client
        .public_decorator_in_public("sample", None)
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let resp = resp.into_model().unwrap();
    assert!(resp.name.is_some());
    assert_eq!(resp.name.unwrap(), "sample".to_string());
}

#[tokio::test]
async fn shared_model_in_operation() {
    let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
    let client = client.get_access_shared_model_in_operation_client();

    let resp = client.public("sample", None).await.unwrap();
    assert_eq!(resp.status(), 200);
    let resp = resp.into_model().unwrap();
    assert!(resp.name.is_some());
    assert_eq!(resp.name.unwrap(), "sample".to_string());

    // We can enable the compilation of the block below via some emitter option to emit internal as public.
    // let resp = client
    //     .internal("sample", None)
    //     .await
    //     .unwrap();
    // assert_eq!(resp.status(), 200);
    // let resp = resp.into_model().unwrap();
    // assert!(resp.name.is_some());
    // assert_eq!(resp.name.unwrap(), "sample".to_string());
}

// #[tokio::test]
// async fn relative_model_in_operation() {
//     let client = AccessClient::with_no_credential("http://localhost:3000", None).unwrap();
//     let client = client.get_access_relative_model_in_operation_client();

// We can enable the compilation of the block below via some emitter option to emit internal as public.
//     let resp = client
//         .operation("Madge", None)
//         .await
//         .unwrap();
//     assert_eq!(resp.status(), 200);
//     let resp = resp.into_model().unwrap();
//     assert!(resp.name.is_some());
//     assert_eq!(resp.name.unwrap(), "Madge".to_string());
//     assert!(resp.inner.is_some());
//     assert!(resp.inner.unwrap().name.is_some());
//     assert_eq!(resp.inner.unwrap().name.unwrap(), "Madge".to_string());

// We can enable the compilation of the block below via some emitter option to emit internal as public.
//     let resp = client
//         .discriminator("real", None)
//         .await
//         .unwrap();
//     assert_eq!(resp.status(), 200);
//     let resp = resp.into_model().unwrap();
//     assert!(resp.name.is_some());
//     assert_eq!(resp.name.unwrap(), "Madge".to_string());
//     assert!(resp.kind.is_some());
//     assert_eq!(resp.kind.unwrap(), "real".to_string());
// }
