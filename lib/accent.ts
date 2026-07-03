export const ACCENT_COLORS = {
  lavender: { label: "Lavender", latte: "#7287fd", frappe: "#babbf1", macchiato: "#b7bdf8", mocha: "#b4befe" },
  blue: { label: "Blue", latte: "#1e66f5", frappe: "#8caaee", macchiato: "#8aadf4", mocha: "#89b4fa" },
  green: { label: "Green", latte: "#40a02b", frappe: "#a6d189", macchiato: "#a6da95", mocha: "#a6e3a1" },
  sapphire: { label: "Sapphire", latte: "#209fb5", frappe: "#85c1dc", macchiato: "#7dc4e4", mocha: "#74c7ec" },
  sky: { label: "Sky", latte: "#04a5e5", frappe: "#99d1db", macchiato: "#91d7e3", mocha: "#89dceb" },
  teal: { label: "Teal", latte: "#179299", frappe: "#81c8be", macchiato: "#8bd5ca", mocha: "#94e2d5" },
  peach: { label: "Peach", latte: "#fe640b", frappe: "#ef9f76", macchiato: "#f5a97f", mocha: "#fab387" },
  red: { label: "Red", latte: "#d20f39", frappe: "#e78284", macchiato: "#ed8796", mocha: "#f38ba8" },
  mauve: { label: "Mauve", latte: "#8839ef", frappe: "#ca9ee6", macchiato: "#c6a0f6", mocha: "#cba6f7" },
};

export type AccentKey = keyof typeof ACCENT_COLORS;

/**
 * Dynamically resolves the hex value for the selected accent color name
 * based on the active Catppuccin theme flavor, and applies it to the
 * document's root element style.
 * 
 * @param accentKey The accent name (e.g. "lavender", "peach")
 * @param themeName The active Catppuccin theme flavor (e.g. "latte", "mocha")
 */
export function applyAccentColor(accentKey: string, themeName: string) {
  const colors = ACCENT_COLORS[accentKey as AccentKey];
  if (!colors) return;

  const themeKey =
    themeName === "latte"
      ? "latte"
      : themeName === "frappe"
      ? "frappe"
      : themeName === "macchiato"
      ? "macchiato"
      : "mocha";

  const hex = colors[themeKey];
  document.documentElement.style.setProperty("--user-accent", hex);
}
