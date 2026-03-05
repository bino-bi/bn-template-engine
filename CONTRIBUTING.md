# Contributing to bn-template-engine

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/bino-bi/bn-template-engine.git
cd bn-template-engine

# Install dependencies
npm install

# Start dev server
npm run start

# Run tests
npm run test
```

## Project Structure

```
src/
  components/       # Stencil web components
  stores/           # @stencil/store state management
  utils/            # Shared utilities and mixins
  context/          # Context protocol for scoped stores
doc/                # Concept guides
```

All `bn-*` components must be wrapped in a `<bn-context>` element. Each component needs `@Element() private element: HTMLElement;` because mixins rely on the host element reference.

## Coding Standards

- **IBCS compliance:** All visual styling (charts, tables, labels, colors, patterns) must follow the latest [IBCS (International Business Communication Standards)](https://www.ibcs.com/standards/). When in doubt, refer to the official IBCS notation guidelines
- **Language:** All code, comments, and documentation must be in English
- **Formatting:** Prettier is enforced via pre-commit hook (`npm run format`)
- **Linting:** ESLint runs in CI (`npm run lint`)
- **Types:** Avoid `any` — use proper interfaces. Avoid `@ts-ignore` unless required by the mixin pattern
- **Tests:** Add or update tests for any changed behavior

### Running a Single Test

```bash
npx stencil test --spec -- src/path/to/file.spec.ts
```

## Pull Request Process

1. Fork the repository and create a feature branch from `master`
2. Make your changes, ensuring lint and tests pass locally
3. Write a clear PR description explaining **what** changed and **why**
4. Keep PRs focused — one feature or fix per PR
5. A maintainer will review and may request changes

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add support for custom date formats
fix: correct variance calculation for negative values
docs: update theming guide
refactor: extract axis rendering from TimeChart
```

## Reporting Issues

- Use the **Bug Report** template for defects (include reproduction steps)
- Use the **Feature Request** template for enhancements
- Search existing issues before opening a new one

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
