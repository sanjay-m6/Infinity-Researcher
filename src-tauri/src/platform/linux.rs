use std::process::Command;

/// Configures a background process for Linux.
pub fn configure_background_process(_cmd: &mut Command) {
    // Linux handles background stdout/stderr via Stdio::null()
}
