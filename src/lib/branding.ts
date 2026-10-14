export type FactoryBranding = {
  factoryName: string;
  shortName: string;
  logoDataUrl: string | null;
  primaryColor: string;
};

export const defaultBranding: FactoryBranding = {
  factoryName: "Ionflow Factory",
  shortName: "IF",
  logoDataUrl: null,
  primaryColor: "#176c65",
};
export const brandingStorageKey = "ionflow.factory-branding.v1";
export const logoFileLimit = 512 * 1024;
export const themePresets = [
  { name: "Ionflow", color: "#176c65" },
  { name: "Gold", color: "#b8954f" },
  { name: "Blue", color: "#306caa" },
  { name: "Violet", color: "#7054aa" },
];
export function isLogoDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 750000 &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  );
}
export function parseBranding(value: unknown): FactoryBranding {
  if (!value || typeof value !== "object") return { ...defaultBranding };
  const fields = value as Record<string, unknown>;
  return {
    factoryName:
      typeof fields.factoryName === "string" && fields.factoryName.trim()
        ? fields.factoryName.trim().slice(0, 80)
        : defaultBranding.factoryName,
    shortName:
      typeof fields.shortName === "string" && fields.shortName.trim()
        ? fields.shortName.trim().slice(0, 12)
        : defaultBranding.shortName,
    logoDataUrl: isLogoDataUrl(fields.logoDataUrl) ? fields.logoDataUrl : null,
    primaryColor:
      typeof fields.primaryColor === "string" &&
      /^#[0-9a-f]{6}$/i.test(fields.primaryColor)
        ? fields.primaryColor.toLowerCase()
        : defaultBranding.primaryColor,
  };
}
export function readBranding(raw: string): FactoryBranding {
  if (raw.length > 751000) return { ...defaultBranding };
  try {
    return parseBranding(JSON.parse(raw));
  } catch {
    return { ...defaultBranding };
  }
}
function channels(hex: string) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}
function luminance(hex: string) {
  const [r, g, b] = channels(hex).map((v) => {
    const n = v / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
function mix(hex: string, target: number, amount: number) {
  return `#${channels(hex)
    .map((v) =>
      Math.round(v * (1 - amount) + target * amount)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
export function themeVariables(primary: string): Record<string, string> {
  const color = parseBranding({ primaryColor: primary }).primaryColor;
  const foreground = luminance(color) > 0.179 ? "#000000" : "#ffffff";
  const ink = luminance(color) > 0.183 ? mix(color, 0, 0.55) : color;
  const sidebar = mix(color, 255, 0.98);
  return {
    "--primary": color,
    "--primary-foreground": foreground,
    "--primary-ink": ink,
    "--ring": ink,
    "--accent": mix(color, 255, 0.92),
    "--accent-foreground": ink,
    "--sidebar": sidebar,
    "--sidebar-foreground": "#20313f",
    "--sidebar-muted": mix(ink, 0, 0.15),
    "--sidebar-line": mix(color, 255, 0.88),
  };
}
