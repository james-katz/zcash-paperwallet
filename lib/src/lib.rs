pub mod paper;

#[cfg(not(target_arch = "wasm32"))]
pub mod pdf;

pub mod json;
pub mod test_vectors;