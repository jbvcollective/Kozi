/**
 * Agent website theme options. Stored in users.data.chosen_agent.theme (one JSONB column).
 * Each theme defines --primary and --primary-hover (hex).
 */
export const AGENT_THEMES = {
  teal: {
    name: "Teal",
    primary: "#1a3c3c",
    primaryHover: "#244d4d",
  },
  navy: {
    name: "Navy",
    primary: "#1e3a5f",
    primaryHover: "#2a4a7a",
  },
  forest: {
    name: "Forest",
    primary: "#1b4332",
    primaryHover: "#2d6a4f",
  },
  burgundy: {
    name: "Burgundy",
    primary: "#5c2a2a",
    primaryHover: "#7a3636",
  },
};

export const DEFAULT_THEME_ID = "teal";

export function getTheme(themeId) {
  return AGENT_THEMES[themeId] || AGENT_THEMES[DEFAULT_THEME_ID];
}
