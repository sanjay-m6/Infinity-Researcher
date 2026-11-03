## Description
<!-- Provide a brief, clear summary of the changes introduced by this pull request. -->

## Type of Change
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 🔒 Security hardening / compliance
- [ ] 📚 Documentation update
- [ ] ⚡ Performance optimization
- [ ] 🎨 UI / UX refinement

## Quality & Verification Checklist
- [ ] My code adheres to the project's coding standards and style guidelines.
- [ ] I have executed `npm run typecheck` and confirmed zero TypeScript errors.
- [ ] I have executed `npm run test` and confirmed all frontend tests pass.
- [ ] I have executed `cargo test` in `./src-tauri` and confirmed all backend tests pass.
- [ ] If Python components were touched, `python -m pytest python-engine/tests -q` passes.
- [ ] I have run `node scripts/audit-secrets.mjs` and verified zero secrets or credentials are included.
- [ ] If this PR modifies functionality or fixes a bug, I have updated `CHANGELOG.md` under `[Unreleased]`.
- [ ] No local SQLite databases, private keys, or personal PDFs are committed.

## Related Issues / Discussions
<!-- Link related GitHub issues: Fixes #123 -->
