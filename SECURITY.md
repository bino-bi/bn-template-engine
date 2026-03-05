# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |
| < 1.0   | No        |

## Reporting a Vulnerability

If you discover a security vulnerability in bn-template-engine, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please send a report via GitHub's private vulnerability reporting feature:

1. Go to the [Security tab](https://github.com/bino-bi/bn-template-engine/security) of this repository
2. Click **"Report a vulnerability"**
3. Provide a description of the issue, steps to reproduce, and any potential impact

### What to Expect

- **Acknowledgment** within 48 hours of your report
- **Status update** within 7 days with an assessment and expected timeline
- **Fix or mitigation** as soon as practical, coordinated with you before public disclosure

## Security Considerations

### Dynamic Template Evaluation

The `<bn-text>` component evaluates template expressions using `new Function()` within a sandboxed scope. This is by design for template interpolation, but means:

- Only use `<bn-text>` with **trusted template content**
- Template input is validated against known dangerous patterns and sandboxed via a Proxy
- HTML output is sanitized (allowlisted tags and attributes)

### Dependencies

We monitor dependencies for known vulnerabilities via GitHub Dependabot and `npm audit`. If you notice a dependency vulnerability that affects this package, please report it using the process above.
