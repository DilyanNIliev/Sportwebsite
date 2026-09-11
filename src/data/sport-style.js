// CSS променливите на един спорт на едно място — шест страници ги ползваха
// с преписан наниз и вторият цвят нямаше как да влезе навсякъде без грешка.
export const sportVars = (s) =>
  s
    ? `--accent:${s.accent};--accent-dark:${s.accentDark};--accent2:${s.accent2};--accent2-dark:${s.accent2Dark}`
    : '';
