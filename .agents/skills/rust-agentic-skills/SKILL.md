---
name: rust-agentic-skills
description: A comprehensive suite of modular, constraint-based skills for autonomous Rust engineering, including idiomatic safe coding, Clippy lint hunting, compiler error resolution, PEG parsing with Pest, RON serialization, and security auditing. Use when writing, debugging, refactoring, or securing Rust code.
---

# Rust Agentic Skills Suite

A modular, constraint-based skillset for autonomous AI coding agents adhering to the Research-Plan-Implement (RPI) methodology and Brain-Tool-Context architecture.

## Included Specialist Skills

The Rust Agentic Skills suite consists of the following 8 specialized skills installed in `.agents/skills/`:

1. **`rust-core` (Rust Core Specialist)**
   - **Scope**: Implementing idiomatic, safe, and performant Rust code.
   - **Capabilities**: Feature implementation, refactoring, strict memory safety, and standard project scaffolding (`src/init_project.sh`).
   - **References**: `references/idiomatic_rust.md`

2. **`lint-hunter` (Lint Hunter)**
   - **Scope**: Debugging compiler errors, borrow checker conflicts, and tracing complex lifetimes.
   - **Capabilities**: Eliminating compiler warnings, solving E0382 / E0502 / E0597 borrow errors, and enforcing `-D warnings`.
   - **References**: `references/compiler_errors.md`

3. **`general-debug` (Debug Helper)**
   - **Scope**: Systematic logic error isolation and debugging.
   - **Capabilities**: Reproducible test generation, panic diagnosis, and trace inspection.

4. **`general-security` (Security Specialist)**
   - **Scope**: Auditing Rust code for unsafe blocks, secret leakage, and memory safety invariants.
   - **Capabilities**: Unsafe boundary containment, dependency vulnerability audits (`cargo audit`), and sanitizing sensitive memory.

5. **`general-syntax` (Syntax Hunter)**
   - **Scope**: Quick resolution of Rust syntax, match arm patterns, trait bounds, and macro invocations.

6. **`pest-specialist` (Pest Specialist)**
   - **Scope**: Building PEG parsers using the `pest` and `pest_derive` crates.
   - **Capabilities**: Grammar generation (`.pest`), AST mapping, and custom parser debugging.

7. **`ron-specialist` (RON Specialist)**
   - **Scope**: Rusty Object Notation serialization and configuration file design.

8. **`router` (Agent Router)**
   - **Scope**: Analyzing user requirements, classifying tasks into Research/Plan/Implement phases, and delegating to the appropriate specialist.

## Workflow Integration

When working on Rust tasks in this repository (`src-tauri/`):
- Run `cargo fmt --check` and `cargo clippy -- -D warnings` to verify code hygiene.
- Apply idiomatic Rust design: favor `Result` over `unwrap`, implement standard traits (`Display`, `Error`, `Clone`), and isolate `unsafe` code with documented safety invariants.
