# Contributing to LOANZ 360

## Branch strategy

- `master` — production branch, deployed to Vercel
- Feature branches: `feat/description`
- Bug fixes: `fix/description`
- All changes go through PRs with CI checks

## PR requirements

1. **Title format**: `feat(scope): description` or `fix(scope): description`
2. **CI must pass**: lint, typecheck, test, build, security
3. **Test coverage**: new routes must include tests
4. **No `any` types**: use `unknown`, `Record<string, unknown>`, or proper interfaces
5. **Rate limiting**: all new API routes must include rate limiting
6. **Zod validation**: all POST/PUT/PATCH routes must validate body with Zod schema

## Code standards

- TypeScript strict mode
- ESLint with `next/core-web-vitals` + `next/typescript`
- Prettier for formatting
- Conventional commits

## Running locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Testing

```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
npm run test:ci       # CI mode
npx playwright test   # E2E tests
```
