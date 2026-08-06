const values = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536,
};

const down = (key) => `(max-width:${values[key] - 0.05}px)`;
const up = (key) => `(min-width:${values[key]}px)`;

export const breakpoints = {
  ...values,
  up: {
    xs: up("xs"),
    sm: up("sm"),
    md: up("md"),
    lg: up("lg"),
    xl: up("xl"),
  },
  down: {
    sm: down("sm"),
    md: down("md"),
    lg: down("lg"),
    xl: down("xl"),
  },
};
