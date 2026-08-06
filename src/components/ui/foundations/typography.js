const displayLg = { fontSize: "2rem", lineHeight: 1.1, fontWeight: 800 };
const headingXl = { fontSize: "1.75rem", lineHeight: 1.15, fontWeight: 800 };
const headingLg = { fontSize: "1.375rem", lineHeight: 1.2, fontWeight: 700 };
const headingMd = { fontSize: "1.125rem", lineHeight: 1.25, fontWeight: 700 };
const bodySm = { fontSize: "0.875rem", lineHeight: 1.5, fontWeight: 400 };
const bodyMd = { fontSize: "1rem", lineHeight: 1.5, fontWeight: 400 };
const bodyLg = { fontSize: "1.125rem", lineHeight: 1.55, fontWeight: 400 };
const captionSm = { fontSize: "0.75rem", lineHeight: 1.35, fontWeight: 500 };
const captionMd = { fontSize: "0.8125rem", lineHeight: 1.4, fontWeight: 500 };

export const typography = {
  display: {
    ...displayLg,
    lg: displayLg,
  },
  heading: {
    xl: headingXl,
    lg: headingLg,
    md: headingMd,
  },
  body: {
    ...bodyMd,
    sm: bodySm,
    md: bodyMd,
    lg: bodyLg,
  },
  caption: {
    ...captionMd,
    sm: captionSm,
    md: captionMd,
  },

  // Backward-compatible aliases
  h1: headingXl,
  h2: headingLg,
  h3: headingMd,
};
