// Wallet data must never reach stdout, stderr or a debugger.
#![deny(clippy::print_stdout, clippy::print_stderr, clippy::dbg_macro)]

pub mod checkpoint;
pub mod paper;

#[cfg(not(target_arch = "wasm32"))]
pub mod pdf;

pub mod json;
pub mod test_vectors;