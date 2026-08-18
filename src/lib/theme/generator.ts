// convert hex color to hsl: [h(0-360), s(0-100), l(0-100)]
export function hexToHsl(hex: string): [number, number, number] {
	const r = parseInt(hex.slice(1, 3), 16) / 255;
	const g = parseInt(hex.slice(3, 5), 16) / 255;
	const b = parseInt(hex.slice(5, 7), 16) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	let h = 0;
	let s = 0;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
			case g: h = ((b - r) / d + 2); break;
			case b: h = ((r - g) / d + 4); break;
		}
		h *= 60;
	}

	return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function css(h: number, s: number, l: number): string {
	return `hsl(${h} ${s}% ${l}%)`;
}

// clamp lightness to 0-100 range
const clamp = (v: number) => Math.max(0, Math.min(100, v));

// generate all theme css variables from a background hex color
// dark backgrounds (l < 50) produce dark theme, light backgrounds produce light theme
export function generateThemeVars(bgHex: string): Record<string, string> {
	const [h, s, l] = hexToHsl(bgHex);
	const isDark = l < 50;

	// reduce chroma for derived colors to keep them subtle
	const sc = Math.round(s * 0.3); // chroma-reduced saturation

	if (isDark) {
		return {
			'--background': css(h, s, l),
			'--foreground': css(h, sc, 98),
			'--card': css(h, sc, clamp(l + 5)),
			'--card-foreground': css(h, sc, 98),
			'--popover': css(h, sc, clamp(l + 10)),
			'--popover-foreground': css(h, sc, 98),
			'--primary': css(h, Math.round(s * 0.5), 92),
			'--primary-foreground': css(h, sc, l),
			'--secondary': css(h, sc, clamp(l + 10)),
			'--secondary-foreground': css(h, sc, 98),
			'--muted': css(h, sc, clamp(l + 10)),
			'--muted-foreground': css(h, sc, 71),
			'--accent': css(h, sc, clamp(l + 20)),
			'--accent-foreground': css(h, sc, 98),
			'--destructive': css(0, 84, 60),
			'--destructive-foreground': css(0, 0, 98),
			'--border': css(h, sc, clamp(l + 12)),
			'--input': css(h, sc, clamp(l + 17)),
			'--ring': css(h, sc, clamp(l + 40)),
			'--sidebar': css(h, sc, clamp(l + 5)),
			'--sidebar-foreground': css(h, sc, 98),
			'--sidebar-primary': css(h, Math.round(s * 0.5), 92),
			'--sidebar-primary-foreground': css(h, sc, l),
			'--sidebar-accent': css(h, sc, clamp(l + 10)),
			'--sidebar-accent-foreground': css(h, sc, 98),
			'--sidebar-border': css(h, sc, clamp(l + 12)),
			'--sidebar-ring': css(h, sc, clamp(l + 30)),
		};
	}

	// light theme
	return {
		'--background': css(h, s, l),
		'--foreground': css(h, sc, 5),
		'--card': css(h, sc, clamp(l - 3)),
		'--card-foreground': css(h, sc, 5),
		'--popover': css(h, sc, 98),
		'--popover-foreground': css(h, sc, 5),
		'--primary': css(h, Math.round(s * 0.5), 20),
		'--primary-foreground': css(h, sc, 98),
		'--secondary': css(h, sc, clamp(l - 5)),
		'--secondary-foreground': css(h, sc, 5),
		'--muted': css(h, sc, clamp(l - 5)),
		'--muted-foreground': css(h, sc, 40),
		'--accent': css(h, sc, clamp(l - 10)),
		'--accent-foreground': css(h, sc, 5),
		'--destructive': css(0, 84, 55),
		'--destructive-foreground': css(0, 0, 98),
		'--border': css(h, sc, clamp(l - 5)),
		'--input': css(h, sc, clamp(l - 8)),
		'--ring': css(h, sc, 55),
		'--sidebar': css(h, sc, clamp(l - 3)),
		'--sidebar-foreground': css(h, sc, 5),
		'--sidebar-primary': css(h, Math.round(s * 0.5), 20),
		'--sidebar-primary-foreground': css(h, sc, 98),
		'--sidebar-accent': css(h, sc, clamp(l - 5)),
		'--sidebar-accent-foreground': css(h, sc, 5),
		'--sidebar-border': css(h, sc, clamp(l - 5)),
		'--sidebar-ring': css(h, sc, 50),
	};
}

// check if a hex color is dark (for toggling .dark class)
export function isDarkColor(hex: string): boolean {
	return hexToHsl(hex)[2] < 50;
}
