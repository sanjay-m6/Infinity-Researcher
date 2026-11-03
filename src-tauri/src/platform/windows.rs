use std::os::windows::process::CommandExt;
use std::process::Command;

/// Windows creation flag to spawn subprocesses without a console window.
pub const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Configures a Command to run headlessly without popping up a console window on Windows.
pub fn configure_background_process(cmd: &mut Command) {
    cmd.creation_flags(CREATE_NO_WINDOW);
}
