import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

// ESLint 9 flat config (Next.js 16 removed the built-in `next lint`).
const eslintConfig = [
  ...nextCoreWebVitals,
  {
    rules: {
      // New React-Compiler rule (Next 16): flags the standard data-fetching
      // pattern of calling setState inside an effect (e.g. setLoading(true)).
      // This is intentional and pervasive here, so keep it as a hint, not an error.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
]

export default eslintConfig
