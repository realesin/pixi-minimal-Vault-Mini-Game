import type { BgConfig } from ".";

type Config = {
  backgrounds: Record<string, BgConfig>;
};

// empty configuration
export default {
  backgrounds: {},
} as Config;