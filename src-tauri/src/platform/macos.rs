use std::process::Command;

/// Configures a background process for macOS.
pub fn configure_background_process(_cmd: &mut Command) {
    // macOS handles background stdout/stderr via Stdio::null()
}
