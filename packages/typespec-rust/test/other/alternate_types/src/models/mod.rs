// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

pub use super::generated::models::*;

use {
    serde::{Deserialize, Serialize},
    std::fmt,
};

#[derive(Clone, Default, Deserialize, Serialize)]
pub struct HandWrittenType {}

impl fmt::Display for HandWrittenType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "handwritten-type")
    }
}
