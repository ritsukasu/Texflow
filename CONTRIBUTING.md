# Contributing

Thanks for helping improve Texflow.

## Setup

```bash
npm install
npm run dev
```

You need Node.js 20.19 or newer and a TeX Live installation with `latexmk`.

## Before opening a pull request

1. Run `npm test` and make sure every test passes.
2. Run `npm run build` to confirm the client bundles.
3. Add or update tests for any backend change, especially around authorization, validation and the build sandbox.
4. Keep the interface consistent. Use the existing design tokens in `client/src/styles/base.css` instead of hard-coded colours, and check both themes.
5. Keep animations purposeful and make sure they respect `prefers-reduced-motion`.

## Guidelines

- Every new API route requires authentication unless it is explicitly public, and must check ownership in the data layer.
- Validate input at the boundary and return generic error messages.
- Never log request bodies, tokens or file contents.

## Reporting bugs

Open an issue with the steps to reproduce, what you expected and what happened. For security problems, follow [SECURITY.md](SECURITY.md) instead.
