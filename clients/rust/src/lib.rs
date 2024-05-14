#![allow(clippy::new_without_default)]

mod generated;
mod hooked;

pub use generated::programs::TENSOR_AMM_ID as ID;
pub use generated::*;
pub use hooked::*;
