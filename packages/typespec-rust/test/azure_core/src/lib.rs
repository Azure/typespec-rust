// Copyright (c) Microsoft Corporation. All rights reserved.
//
// Licensed under the MIT License. See License.txt in the project root for license information.

use std::{
    any::{Any, TypeId},
    collections::HashMap,
    fmt::Debug,
    ops::{Deref, DerefMut},
    rc::Rc,
};

#[derive(Debug, Default)]
pub struct ClientMethodOptions {
    context: Context,
}

impl ClientMethodOptions {
    pub fn set_context(&mut self, context: &Context) {
        self.context
            .extend(context.iter().map(|(k, v)| (k.to_owned(), v.to_owned())));
    }
}

impl Clone for ClientMethodOptions {
    fn clone(&self) -> Self {
        unimplemented!();
    }
}

pub trait ClientMethodOptionsBuilder {
    fn with_context(self, _context: &Context) -> Self
    where
        Self: Sized,
    {
        unimplemented!()
    }
}

pub type ContextInner = HashMap<TypeId, Rc<dyn Any + Send + Sync>>;
#[derive(Default)]
pub struct Context(ContextInner);
pub type Headers = HashMap<String, String>;

impl Debug for Context {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut m = f.debug_map();
        for (&k, ref v) in self.0.iter() {
            match k {
                _ if k == TypeId::of::<HashMap<String, String>>() => {
                    m.key(&"HashMap<String, String>");
                    m.value(&v.downcast_ref::<HashMap<String, String>>().unwrap());
                }
                _ if k == TypeId::of::<String>() => {
                    m.key(&"String");
                    m.value(&v.downcast_ref::<String>().unwrap());
                }
                _ => {
                    m.key(&k);
                    m.value(&v);
                }
            };
        }
        m.finish()
    }
}

impl Deref for Context {
    type Target = ContextInner;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for Context {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

#[derive(Debug)]
pub struct Error;

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        <Error as Debug>::fmt(self, f)
    }
}

impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        None
    }
}

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug)]
pub struct Response<T> {
    model: T,
}

impl<T> Response<T> {
    pub fn body(self) -> T {
        self.model
    }
}

impl<T> From<T> for Response<T> {
    fn from(model: T) -> Self {
        Self { model }
    }
}
