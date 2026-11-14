//#region src/color.ts
var e = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
function t(t, n) {
	if (typeof t != "string") return n;
	let r = t.trim().match(e);
	if (!r) return n;
	let i = r[1].toLowerCase();
	return i.length === 3 && (i = i.replace(/./g, (e) => e + e)), "#" + i;
}
function n(e) {
	let n = parseInt(t(e, "#000000").slice(1), 16);
	return [
		(n >> 16 & 255) / 255,
		(n >> 8 & 255) / 255,
		(n & 255) / 255
	];
}
//#endregion
//#region src/presets.ts
var r = {
	lazuli: {
		label: "Lazuli",
		config: {}
	},
	silk: {
		label: "Silk",
		config: {
			shape: { type: "waves" },
			waves: {
				count: 4,
				amplitude: 35,
				wavelength: 70,
				thickness: 45,
				softness: 80,
				spread: 40,
				twist: 25,
				angle: -12
			},
			color: {
				palette: [
					"#f6c1d9",
					"#b388ff",
					"#5b3fd1"
				],
				fade: 20
			},
			background: {
				type: "gradient",
				gradient: ["#fff7fb", "#efe9ff"],
				angle: 160
			},
			texture: {
				type: "grain",
				intensity: 30
			}
		}
	},
	ripple: {
		label: "Ripple",
		config: {
			shape: { type: "rings" },
			rings: {
				count: 10,
				spacing: 34,
				thickness: 45,
				softness: 60,
				distortion: 25,
				centerX: 35,
				centerY: 45
			},
			color: {
				palette: ["#7fd1c7", "#127a82"],
				fade: 45
			},
			background: { color: "#f3fbfa" }
		}
	},
	screen: {
		label: "Screen",
		config: {
			blobs: {
				count: 4,
				size: 110
			},
			color: { palette: ["#ff7a59", "#e2375b"] },
			background: { color: "#fff6ea" },
			texture: {
				type: "halftone",
				intensity: 100,
				scale: 2,
				angle: 30
			}
		}
	},
	stripe: {
		label: "Stripe",
		config: {
			shape: { type: "bands" },
			bands: {
				count: 9,
				angle: 20,
				width: 45,
				softness: 10,
				warp: 45,
				warpScale: 30
			},
			color: {
				palette: [
					"#ffd35c",
					"#ff8a3d",
					"#e84a5f"
				],
				steps: 3,
				fade: 0
			},
			background: { color: "#fffaf0" },
			texture: { type: "none" }
		}
	},
	paper: {
		label: "Paper",
		config: {
			blobs: { softness: 65 },
			color: {
				palette: ["#9ab8a6", "#3f6e5a"],
				fade: 20
			},
			background: { color: "#f4efe4" },
			texture: {
				type: "paper",
				intensity: 70
			}
		}
	},
	night: {
		label: "Night",
		config: {
			blobs: { count: 4 },
			color: {
				palette: [
					"#5b7cfa",
					"#9f5bfa",
					"#f08bd0"
				],
				blend: "screen",
				fade: 25
			},
			background: {
				type: "gradient",
				gradient: ["#060816", "#141a3a"],
				angle: 160
			},
			texture: {
				type: "grain",
				intensity: 45
			}
		}
	},
	plate: {
		label: "Plate",
		config: {
			shape: { type: "nodal" },
			nodal: {
				n: 3,
				m: 7,
				thickness: 14,
				softness: 30,
				scale: 90
			},
			color: {
				palette: ["#d8cfb8", "#fffaf0"],
				fade: 30
			},
			background: { color: "#15130f" },
			texture: {
				type: "grain",
				intensity: 40
			}
		}
	},
	glass: {
		label: "Glass",
		config: {
			color: { opacity: 70 },
			background: { type: "transparent" },
			texture: { type: "none" }
		}
	}
}, i = Object.keys(r);
function a(e) {
	return typeof e == "string" && Object.prototype.hasOwnProperty.call(r, e);
}
//#endregion
//#region src/schema.ts
var o = (e, t) => ({
	...t,
	path: e
}), s = (e) => (t) => t.shape.type === e, c = s("blobs"), l = (e) => e.texture.type !== "none", u = (e) => e.cursor.mode !== "off", d = (...e) => (t) => e.includes(t.texture.type), f = (e) => (t) => t.background.type === e, p = (e) => e.background.type === "gradient" && e.background.kind === "radial", m = [
	o("seed", {
		kind: "number",
		min: -Infinity,
		max: Infinity,
		default: 7226165.5,
		attr: "seed",
		url: "seed",
		label: "Seed"
	}),
	o("quality", {
		kind: "enum",
		options: [
			"auto",
			"high",
			"low"
		],
		default: "auto",
		attr: "quality",
		url: "q",
		label: "Quality"
	}),
	o("shape.type", {
		kind: "enum",
		options: [
			"blobs",
			"waves",
			"bands",
			"rings",
			"dots",
			"nodal"
		],
		default: "blobs",
		attr: "shape",
		url: "sh",
		label: "Shape"
	}),
	o("blobs.count", {
		kind: "number",
		min: 1,
		max: 6,
		int: !0,
		default: 3,
		attr: "blobs-count",
		url: "bc",
		label: "Count",
		when: c
	}),
	o("blobs.size", {
		kind: "number",
		min: 40,
		max: 160,
		default: 100,
		attr: "blobs-size",
		url: "bs",
		label: "Size",
		when: c
	}),
	o("blobs.softness", {
		kind: "number",
		min: 0,
		max: 100,
		default: 50,
		attr: "blobs-softness",
		url: "bf",
		label: "Softness",
		when: c
	}),
	o("blobs.stretch", {
		kind: "number",
		min: 0,
		max: 200,
		default: 100,
		attr: "blobs-stretch",
		url: "bt",
		label: "Stretch",
		when: c
	}),
	o("blobs.merge", {
		kind: "number",
		min: 0,
		max: 100,
		default: 100,
		attr: "blobs-merge",
		url: "bm",
		label: "Merge",
		when: c
	}),
	o("blobs.wobble", {
		kind: "number",
		min: 0,
		max: 100,
		default: 50,
		attr: "blobs-wobble",
		url: "bw",
		label: "Wobble",
		when: c
	}),
	o("blobs.satellite", {
		kind: "bool",
		default: !0,
		attr: "blobs-satellite",
		url: "bx",
		label: "Satellite",
		when: c
	}),
	o("waves.count", {
		kind: "number",
		min: 1,
		max: 8,
		int: !0,
		default: 3,
		attr: "waves-count",
		url: "wc",
		label: "Count",
		when: s("waves")
	}),
	o("waves.amplitude", {
		kind: "number",
		min: 0,
		max: 100,
		default: 40,
		attr: "waves-amplitude",
		url: "wa",
		label: "Amplitude",
		when: s("waves")
	}),
	o("waves.wavelength", {
		kind: "number",
		min: 10,
		max: 100,
		default: 60,
		attr: "waves-wavelength",
		url: "wl",
		label: "Wavelength",
		when: s("waves")
	}),
	o("waves.thickness", {
		kind: "number",
		min: 2,
		max: 100,
		default: 30,
		attr: "waves-thickness",
		url: "wt",
		label: "Thickness",
		when: s("waves")
	}),
	o("waves.softness", {
		kind: "number",
		min: 0,
		max: 100,
		default: 50,
		attr: "waves-softness",
		url: "wf",
		label: "Softness",
		when: s("waves")
	}),
	o("waves.spread", {
		kind: "number",
		min: 0,
		max: 100,
		default: 50,
		attr: "waves-spread",
		url: "ws",
		label: "Spread",
		when: s("waves")
	}),
	o("waves.twist", {
		kind: "number",
		min: 0,
		max: 100,
		default: 30,
		attr: "waves-twist",
		url: "ww",
		label: "Twist",
		when: s("waves")
	}),
	o("waves.angle", {
		kind: "number",
		min: -90,
		max: 90,
		default: 0,
		attr: "waves-angle",
		url: "wn",
		label: "Angle",
		when: s("waves")
	}),
	o("bands.count", {
		kind: "number",
		min: 1,
		max: 30,
		int: !0,
		default: 6,
		attr: "bands-count",
		url: "kc",
		label: "Count",
		when: s("bands")
	}),
	o("bands.angle", {
		kind: "number",
		min: 0,
		max: 180,
		default: 30,
		attr: "bands-angle",
		url: "ka",
		label: "Angle",
		when: s("bands")
	}),
	o("bands.width", {
		kind: "number",
		min: 5,
		max: 95,
		default: 50,
		attr: "bands-width",
		url: "kw",
		label: "Width",
		when: s("bands")
	}),
	o("bands.softness", {
		kind: "number",
		min: 0,
		max: 100,
		default: 40,
		attr: "bands-softness",
		url: "kf",
		label: "Softness",
		when: s("bands")
	}),
	o("bands.warp", {
		kind: "number",
		min: 0,
		max: 100,
		default: 30,
		attr: "bands-warp",
		url: "kx",
		label: "Warp",
		when: s("bands")
	}),
	o("bands.warpScale", {
		kind: "number",
		min: 0,
		max: 100,
		default: 50,
		attr: "bands-warp-scale",
		url: "kz",
		label: "Warp size",
		when: s("bands")
	}),
	o("rings.count", {
		kind: "number",
		min: 1,
		max: 24,
		int: !0,
		default: 6,
		attr: "rings-count",
		url: "rc",
		label: "Count",
		when: s("rings")
	}),
	o("rings.spacing", {
		kind: "number",
		min: 5,
		max: 100,
		default: 40,
		attr: "rings-spacing",
		url: "rs",
		label: "Spacing",
		when: s("rings")
	}),
	o("rings.thickness", {
		kind: "number",
		min: 2,
		max: 100,
		default: 30,
		attr: "rings-thickness",
		url: "rt",
		label: "Thickness",
		when: s("rings")
	}),
	o("rings.softness", {
		kind: "number",
		min: 0,
		max: 100,
		default: 40,
		attr: "rings-softness",
		url: "rf",
		label: "Softness",
		when: s("rings")
	}),
	o("rings.centerX", {
		kind: "number",
		min: 0,
		max: 100,
		default: 50,
		attr: "rings-center-x",
		url: "rx",
		label: "Center X",
		when: s("rings")
	}),
	o("rings.centerY", {
		kind: "number",
		min: 0,
		max: 100,
		default: 50,
		attr: "rings-center-y",
		url: "ry",
		label: "Center Y",
		when: s("rings")
	}),
	o("rings.sources", {
		kind: "number",
		min: 1,
		max: 3,
		int: !0,
		default: 1,
		attr: "rings-sources",
		url: "rn",
		label: "Sources",
		when: s("rings")
	}),
	o("rings.distortion", {
		kind: "number",
		min: 0,
		max: 100,
		default: 20,
		attr: "rings-distortion",
		url: "rd",
		label: "Distortion",
		when: s("rings")
	}),
	o("dots.spacing", {
		kind: "number",
		min: 6,
		max: 120,
		default: 24,
		attr: "dots-spacing",
		url: "os",
		label: "Spacing",
		when: s("dots")
	}),
	o("dots.size", {
		kind: "number",
		min: 0,
		max: 100,
		default: 60,
		attr: "dots-size",
		url: "oz",
		label: "Size",
		when: s("dots")
	}),
	o("dots.softness", {
		kind: "number",
		min: 0,
		max: 100,
		default: 20,
		attr: "dots-softness",
		url: "of",
		label: "Softness",
		when: s("dots")
	}),
	o("dots.grid", {
		kind: "enum",
		options: ["square", "hex"],
		default: "hex",
		attr: "dots-grid",
		url: "og",
		label: "Grid",
		when: s("dots")
	}),
	o("dots.jitter", {
		kind: "number",
		min: 0,
		max: 100,
		default: 0,
		attr: "dots-jitter",
		url: "oj",
		label: "Jitter",
		when: s("dots")
	}),
	o("dots.modulation", {
		kind: "number",
		min: 0,
		max: 100,
		default: 60,
		attr: "dots-modulation",
		url: "om",
		label: "Modulation",
		when: s("dots")
	}),
	o("nodal.n", {
		kind: "number",
		min: 1,
		max: 12,
		int: !0,
		default: 3,
		attr: "nodal-n",
		url: "nn",
		label: "Mode n",
		when: s("nodal")
	}),
	o("nodal.m", {
		kind: "number",
		min: 1,
		max: 12,
		int: !0,
		default: 5,
		attr: "nodal-m",
		url: "nm",
		label: "Mode m",
		when: s("nodal")
	}),
	o("nodal.thickness", {
		kind: "number",
		min: 2,
		max: 100,
		default: 20,
		attr: "nodal-thickness",
		url: "nt",
		label: "Thickness",
		when: s("nodal")
	}),
	o("nodal.softness", {
		kind: "number",
		min: 0,
		max: 100,
		default: 40,
		attr: "nodal-softness",
		url: "nf",
		label: "Softness",
		when: s("nodal")
	}),
	o("nodal.scale", {
		kind: "number",
		min: 20,
		max: 200,
		default: 100,
		attr: "nodal-scale",
		url: "nz",
		label: "Scale",
		when: s("nodal")
	}),
	o("nodal.style", {
		kind: "enum",
		options: ["lines", "regions"],
		default: "lines",
		attr: "nodal-style",
		url: "ny",
		label: "Style",
		when: s("nodal")
	}),
	o("color.palette", {
		kind: "colors",
		minItems: 2,
		maxItems: 5,
		default: ["#4c78d8", "#1f48a8"],
		attr: "color-palette",
		url: "pal",
		label: "Palette"
	}),
	o("color.mapping", {
		kind: "enum",
		options: ["layers", "cycle"],
		default: "layers",
		attr: "color-mapping",
		url: "map",
		label: "Mapping"
	}),
	o("color.steps", {
		kind: "number",
		min: 0,
		max: 8,
		int: !0,
		default: 0,
		normalize: (e) => e === 1 ? 2 : e,
		attr: "color-steps",
		url: "st",
		label: "Steps"
	}),
	o("color.blend", {
		kind: "enum",
		options: [
			"normal",
			"multiply",
			"screen",
			"overlay",
			"soft-light",
			"difference"
		],
		default: "normal",
		attr: "color-blend",
		url: "bl",
		label: "Blend",
		when: (e) => e.background.type !== "transparent"
	}),
	o("color.opacity", {
		kind: "number",
		min: 0,
		max: 100,
		default: 100,
		attr: "color-opacity",
		url: "op",
		label: "Opacity"
	}),
	o("color.fade", {
		kind: "number",
		min: 0,
		max: 100,
		default: 35,
		attr: "color-fade",
		url: "fd",
		label: "Corner fade"
	}),
	o("texture.type", {
		kind: "enum",
		options: [
			"none",
			"grain",
			"noise",
			"halftone",
			"dither",
			"paper"
		],
		default: "grain",
		attr: "texture-type",
		url: "tt",
		label: "Type"
	}),
	o("texture.intensity", {
		kind: "number",
		min: 0,
		max: 100,
		default: 35,
		attr: "texture-intensity",
		url: "ti",
		label: "Amount",
		when: l
	}),
	o("texture.scale", {
		kind: "number",
		min: 1,
		max: 16,
		default: 1,
		attr: "texture-scale",
		url: "tz",
		label: "Scale",
		when: l
	}),
	o("texture.contrast", {
		kind: "number",
		min: 0,
		max: 100,
		default: 50,
		attr: "texture-contrast",
		url: "tc",
		label: "Contrast",
		when: l
	}),
	o("texture.animated", {
		kind: "bool",
		default: !0,
		attr: "texture-animated",
		url: "ta",
		label: "Animated",
		when: d("grain", "noise", "dither")
	}),
	o("texture.target", {
		kind: "enum",
		options: ["all", "pattern"],
		default: "all",
		attr: "texture-target",
		url: "tg",
		label: "Applies to",
		when: d("grain", "noise", "paper")
	}),
	o("texture.mono", {
		kind: "bool",
		default: !0,
		attr: "texture-mono",
		url: "tm",
		label: "Monochrome",
		when: d("grain", "noise")
	}),
	o("texture.octaves", {
		kind: "number",
		min: 1,
		max: 5,
		int: !0,
		default: 3,
		attr: "texture-octaves",
		url: "to",
		label: "Detail",
		when: d("noise", "paper")
	}),
	o("texture.angle", {
		kind: "number",
		min: 0,
		max: 90,
		default: 45,
		attr: "texture-angle",
		url: "tn",
		label: "Angle",
		when: d("halftone")
	}),
	o("texture.dotShape", {
		kind: "enum",
		options: [
			"dot",
			"line",
			"square"
		],
		default: "dot",
		attr: "texture-dot-shape",
		url: "td",
		label: "Dot",
		when: d("halftone")
	}),
	o("texture.matrix", {
		kind: "enum",
		options: [
			"bayer4",
			"bayer8",
			"ign"
		],
		default: "bayer8",
		attr: "texture-matrix",
		url: "tx",
		label: "Pattern",
		when: d("dither")
	}),
	o("texture.levels", {
		kind: "number",
		min: 2,
		max: 16,
		int: !0,
		default: 4,
		attr: "texture-levels",
		url: "tl",
		label: "Levels",
		when: d("dither")
	}),
	o("texture.fibers", {
		kind: "number",
		min: 0,
		max: 100,
		default: 40,
		attr: "texture-fibers",
		url: "tf",
		label: "Fibers",
		when: d("paper")
	}),
	o("background.type", {
		kind: "enum",
		options: [
			"solid",
			"gradient",
			"transparent"
		],
		default: "solid",
		attr: "background-type",
		url: "bg",
		label: "Type"
	}),
	o("background.color", {
		kind: "color",
		default: "#ffffff",
		attr: "background-color",
		url: "bgc",
		label: "Color",
		when: f("solid")
	}),
	o("background.gradient", {
		kind: "colors",
		minItems: 2,
		maxItems: 3,
		default: ["#ffffff", "#e8eefb"],
		attr: "background-gradient",
		url: "bgg",
		label: "Gradient",
		when: f("gradient")
	}),
	o("background.kind", {
		kind: "enum",
		options: ["linear", "radial"],
		default: "linear",
		attr: "background-kind",
		url: "bgk",
		label: "Kind",
		when: f("gradient")
	}),
	o("background.angle", {
		kind: "number",
		min: 0,
		max: 360,
		default: 180,
		attr: "background-angle",
		url: "bga",
		label: "Angle",
		when: (e) => e.background.type === "gradient" && e.background.kind === "linear"
	}),
	o("background.centerX", {
		kind: "number",
		min: 0,
		max: 100,
		default: 50,
		attr: "background-center-x",
		url: "bgx",
		label: "Center X",
		when: p
	}),
	o("background.centerY", {
		kind: "number",
		min: 0,
		max: 100,
		default: 50,
		attr: "background-center-y",
		url: "bgy",
		label: "Center Y",
		when: p
	}),
	o("motion.speed", {
		kind: "number",
		min: 0,
		max: 1.5,
		default: .35,
		attr: "motion-speed",
		url: "sp",
		label: "Speed"
	}),
	o("motion.direction", {
		kind: "number",
		min: 0,
		max: 360,
		default: 0,
		attr: "motion-direction",
		url: "dir",
		label: "Direction",
		when: (e) => e.shape.type !== "blobs" && e.shape.type !== "nodal" || e.texture.type === "noise"
	}),
	o("motion.loop", {
		kind: "number",
		min: 0,
		max: 60,
		default: 0,
		normalize: (e) => e > 0 && e < 2 ? 2 : e,
		attr: "motion-loop",
		url: "lp",
		label: "Loop"
	}),
	o("motion.reducedMotion", {
		kind: "enum",
		options: ["respect", "ignore"],
		default: "respect",
		attr: "reduced-motion",
		url: "rm",
		label: "Reduced motion"
	}),
	o("cursor.mode", {
		kind: "enum",
		options: [
			"push",
			"pull",
			"swirl",
			"off"
		],
		default: "push",
		attr: "cursor-mode",
		url: "cm",
		label: "Mode"
	}),
	o("cursor.strength", {
		kind: "number",
		min: 0,
		max: 100,
		default: 60,
		attr: "cursor-strength",
		url: "cs",
		label: "Strength",
		when: u
	}),
	o("cursor.radius", {
		kind: "number",
		min: 0,
		max: 100,
		default: 50,
		attr: "cursor-radius",
		url: "cr",
		label: "Radius",
		when: u
	}),
	o("cursor.smear", {
		kind: "number",
		min: 0,
		max: 100,
		default: 50,
		attr: "cursor-smear",
		url: "cd",
		label: "Smear",
		when: u
	}),
	o("cursor.follow", {
		kind: "number",
		min: 0,
		max: 100,
		default: 50,
		attr: "cursor-follow",
		url: "cf",
		label: "Follow",
		when: u
	})
];
new Map(m.map((e) => [e.path, e]));
function h(e, t) {
	let [n, r] = t.split("."), i = e[n];
	return r === void 0 ? i : i[r];
}
function g(e, t, n) {
	let [r, i] = t.split("."), a = e;
	i === void 0 ? a[r] = n : a[r][i] = n;
}
function _(e, t) {
	return !e.when || e.when(t);
}
function ee() {
	let e = {};
	for (let t of m) {
		let [n, r] = t.path.split("."), i = Array.isArray(t.default) ? [...t.default] : t.default;
		r === void 0 ? e[n] = i : (e[n] ?? (e[n] = {}))[r] = i;
	}
	return e;
}
var v = b(ee());
function y(e) {
	let t = {};
	for (let [n, r] of Object.entries(e)) t[n] = r && typeof r == "object" ? Object.fromEntries(Object.entries(r).map(([e, t]) => [e, Array.isArray(t) ? [...t] : t])) : r;
	return t;
}
function b(e) {
	if (e && typeof e == "object") {
		for (let t of Object.values(e)) b(t);
		Object.freeze(e);
	}
	return e;
}
//#endregion
//#region src/config.ts
var x = (e) => !!e && typeof e == "object" && !Array.isArray(e);
function S(e) {
	let t = [], n = e.edge, r = e.core;
	(n != null || r != null) && t.push(["color.palette", {
		edge: n,
		core: r
	}]), e.ground != null && t.push(["background.type", "solid"], ["background.color", e.ground]), e.count != null && t.push(["blobs.count", e.count]), e.size != null && t.push(["blobs.size", e.size]), e.softness != null && t.push(["blobs.softness", e.softness]);
	let i = e.texture;
	if (typeof i == "number" || typeof i == "string" && i.trim() !== "" && Number.isFinite(Number(i))) {
		let e = Number(i);
		t.push(["texture.type", e > 0 ? "grain" : "none"], ["texture.intensity", e]);
	}
	return e.speed != null && t.push(["motion.speed", e.speed]), typeof e.cursor == "string" && t.push(["cursor.mode", e.cursor]), e.strength != null && t.push(["cursor.strength", e.strength]), typeof e.respectReducedMotion == "boolean" && t.push(["motion.reducedMotion", e.respectReducedMotion ? "respect" : "ignore"]), t;
}
function te(e) {
	let t = [];
	for (let n of m) {
		let [r, i] = n.path.split("."), a = e[r];
		i === void 0 ? a !== void 0 && t.push([n.path, a]) : x(a) && a[i] !== void 0 && t.push([n.path, a[i]]);
	}
	return typeof e.shape == "string" && t.push(["shape.type", e.shape]), t;
}
var ne = (e, t, n) => Math.min(n, Math.max(t, e));
function C(e, n, r) {
	switch (e.kind) {
		case "number": {
			let t = typeof n == "string" ? parseFloat(n) : n;
			if (typeof t != "number" || !Number.isFinite(t)) return r;
			let i = ne(t, e.min, e.max), a = e.int ? Math.round(i) : i;
			return e.normalize ? e.normalize(a) : a;
		}
		case "enum": return e.options.includes(String(n)) ? String(n) : r;
		case "bool": return typeof n == "boolean" ? n : n === "" || n === "true" || n === "1" ? !0 : n === "false" || n === "0" ? !1 : r;
		case "color": return t(n, r);
		case "colors": {
			let i = Array.isArray(n) ? n : typeof n == "string" ? n.split(/[\s,]+|-(?=#?[0-9a-f])/i) : null;
			if (!i) return r;
			let a = i.map((e) => t(e, "")).filter(Boolean).slice(0, e.maxItems);
			return a.length >= e.minItems ? a : r;
		}
	}
}
function w(e = {}, n = v) {
	let r = e, i = a(r.preset) ? T(r.preset) : y(n), o = [...S(r), ...te(r)];
	for (let [e, n] of o) {
		let r = m.find((t) => t.path === e), a = n;
		if (e === "color.palette" && x(n) && ("edge" in n || "core" in n)) {
			let e = [...i.color.palette];
			n.edge != null && (e[0] = t(n.edge, e[0])), n.core != null && (e[e.length - 1] = t(n.core, e[e.length - 1])), a = e;
		}
		g(i, r.path, C(r, a, h(i, r.path)));
	}
	return i;
}
function T(e) {
	return w(r[e].config, v);
}
function re(e, t) {
	let n = {}, r = e[t === "url" ? "p" : "preset"];
	a(r) && (n.preset = r);
	for (let r of m) {
		let i = e[r[t]];
		if (i == null) continue;
		let [a, o] = r.path.split(".");
		o === void 0 ? n[a] = i : (n[a] ?? (n[a] = {}))[o] = t === "url" && (r.kind === "color" || r.kind === "colors") ? E(i) : i;
	}
	for (let r of D) {
		let i = e[r];
		i != null && (r === "texture" || r === "cursor" ? n[r] === void 0 && (n[r] = i) : n[r] = t === "url" && (r === "core" || r === "edge" || r === "ground") ? E(i) : i);
	}
	return n;
}
var E = (e) => e.split("-").map((e) => `#${e.replace(/^#/, "")}`).join(","), D = [
	"core",
	"edge",
	"ground",
	"count",
	"size",
	"softness",
	"texture",
	"speed",
	"cursor",
	"strength"
], O = (e) => Number.isInteger(e) ? e : Math.round(e * 100) / 100;
function k(e, t) {
	return Array.isArray(e) && Array.isArray(t) ? e.length === t.length && e.every((e, n) => e === t[n]) : typeof e == "number" && typeof t == "number" ? O(e) === O(t) : e === t;
}
function A(e, t, n) {
	if (e.kind === "colors") {
		let e = t;
		return n === "url" ? e.map((e) => e.slice(1)).join("-") : e.join(",");
	}
	return e.kind === "color" ? n === "url" ? t.slice(1) : t : String(typeof t == "number" ? e.path === "seed" ? t : O(t) : t);
}
function ie(e, t, n = {}) {
	let { onlyChanged: r = !0, onlyActive: i = !0, base: a = v } = n, o = [];
	for (let n of m) {
		if (i && !_(n, e)) continue;
		let s = h(e, n.path);
		r && k(s, h(a, n.path)) || o.push([n[t], A(n, s, t)]);
	}
	return o;
}
function ae(e, t = v) {
	let n = {};
	for (let r of m) {
		if (!_(r, e)) continue;
		let i = h(e, r.path);
		if (k(i, h(t, r.path))) continue;
		let [a, o] = r.path.split("."), s = typeof i == "number" && r.path !== "seed" ? O(i) : i;
		o === void 0 ? n[a] = s : (n[a] ?? (n[a] = {}))[o] = s;
	}
	return n;
}
//#endregion
//#region src/shader.ts
var oe = "attribute vec2 a_pos;\nvoid main() { gl_Position = vec4(a_pos, 0.0, 1.0); }", se = "precision highp float;\nuniform vec2 u_res; uniform float u_time; uniform float u_dpr;\nuniform vec2 u_mouse; uniform vec2 u_vel; uniform float u_active;\nuniform float u_pull; uniform float u_cursorR; uniform float u_smear; uniform float u_cursorMode;\nuniform float u_period; uniform vec2 u_flow;\nuniform vec3 u_pal[5]; uniform float u_palN; uniform float u_mapping; uniform float u_steps; uniform float u_blend;\nuniform float u_opacity; uniform float u_fade;\nuniform float u_bgType; uniform vec3 u_bg[3]; uniform float u_bgN;\nuniform float u_bgKind; uniform float u_bgAngle; uniform vec2 u_bgCenter;\nuniform float u_texIntensity; uniform float u_texScale; uniform float u_texGamma;\nuniform float u_texAnimated; uniform float u_texTarget; uniform float u_texMono;\nuniform float u_texOctaves; uniform float u_texAngle; uniform float u_texDotShape;\nuniform float u_texMatrix; uniform float u_texLevels; uniform float u_texFibers;\nfloat g_cov; float g_tone; vec3 g_flat; float g_isFlat;\nfloat hash(float n) { return fract(sin(n) * 43758.5453123); }\nfloat noise(vec2 p) {\nvec2 i = floor(p), f = fract(p);\nvec2 u = f * f * (3.0 - 2.0 * f);\nfloat a = hash(dot(i, vec2(1.0, 57.0)));\nfloat b = hash(dot(i + vec2(1.0, 0.0), vec2(1.0, 57.0)));\nfloat c = hash(dot(i + vec2(0.0, 1.0), vec2(1.0, 57.0)));\nfloat d = hash(dot(i + vec2(1.0, 1.0), vec2(1.0, 57.0)));\nreturn mix(mix(a, b, u.x), mix(c, d, u.x), u.y);\n}\nfloat lr(float rate) {\nif (u_period <= 0.0) return rate;\nfloat k = max(floor(abs(rate) * u_period + 0.5), 1.0);\nreturn sign(rate) * k / u_period;\n}\nfloat lf(float f) { return u_period <= 0.0 ? f : 6.2831853 * lr(f / 6.2831853); }\nvec2 drift(vec2 v, float t) {\nif (u_period <= 0.0) return v * t;\nfloat speed = length(v);\nif (speed == 0.0) return vec2(0.0);\nvec2 d = v / speed;\nfloat th = 6.2831853 * t / u_period;\nreturn speed * u_period / 6.2831853 * (sin(th) * d + (1.0 - cos(th)) * vec2(-d.y, d.x));\n}\nfloat fbm(vec2 p, float octaves) {\nfloat v = 0.0, a = 0.5, sum = 0.0;\nfor (int i = 0; i < 5; i++) {\nif (float(i) >= octaves) break;\nv += a * noise(p);\nsum += a;\np = p * 2.03 + 17.1;\na *= 0.5;\n}\nreturn v / sum;\n}\nfloat contrastCurve(float g) {\nif (u_texGamma == 1.0) return g;\nreturn sign(g) * 0.5 * pow(max(abs(2.0 * g), 1e-6), u_texGamma);\n}", ce = "vec3 palAt(float i) {\nfloat k = floor(mod(i + 0.5, u_palN));\nvec3 c = u_pal[0];\nfor (int j = 1; j < 5; j++) if (float(j) == k) c = u_pal[j];\nreturn c;\n}\nfloat stepEdge(float a) { return u_steps > 0.5 ? smoothstep(0.46, 0.54, a) : a; }\nfloat stepTone(float u) {\nif (u_steps < 0.5) return u;\nfloat x = clamp(u, 0.0, 1.0) * u_steps;\nreturn min((floor(x) + smoothstep(0.9, 1.0, fract(x))) / u_steps, 1.0);\n}\nvec4 shadeFlat(float coverage, vec3 col) {\ng_cov = coverage; g_flat = col; g_isFlat = 1.0;\nfloat a = stepEdge(coverage);\nreturn vec4(col * a, a);\n}\nvec4 shade(float coverage, float tone) {\ng_cov = coverage; g_tone = tone; g_isFlat = 0.0;\ncoverage = stepEdge(coverage);\ntone = stepTone(tone);\nvec4 P = vec4(u_pal[0] * coverage, coverage);\nfor (int k = 1; k < 5; k++) {\nif (float(k) >= u_palN) break;\nfloat span = u_palN - 1.0;\nfloat c = smoothstep(float(k - 1) / span, float(k) / span, tone);\nP = vec4(u_pal[k] * c, c) + P * (1.0 - c);\n}\nreturn P;\n}", j = "uniform float u_count; uniform float u_size; uniform float u_soft;\nuniform float u_stretch; uniform float u_merge; uniform float u_wobble;\nuniform vec4 u_blob[6];\nuniform vec4 u_orbit[6];\nconst float FALLOFF = 1.8;\nconst float CORE_LO = 0.525;\nconst float CORE_HI = 1.54;\nvec4 shapeColor(vec2 p, float t) {\nfloat aspect = u_res.x / u_res.y;\nvec2 wob = drift(vec2(0.4), t);\np += u_wobble * vec2(noise(p * 3.0 + wob), noise(p * 3.0 - wob + 7.0)) - u_wobble * 0.5;\nfloat field = 0.0;\nfloat peak = 0.0;\nvec3 cyc = vec3(0.0);\nfor (int i = 0; i < 6; i++) {\nif (float(i) >= u_count) break;\nvec4 b = u_blob[i];\nvec4 o = u_orbit[i];\nfloat p1 = o.w;\nfloat p2 = o.w * 1.3 + 1.7;\nfloat p3 = o.w * 0.7 + 2.9;\nvec2 c = vec2(b.x * aspect, b.y) + vec2(sin(t * lf(o.x) + p1) - sin(p1), cos(t * lf(o.y) + p2) - cos(p2)) * o.z;\nfloat r = b.z * u_size;\nvec2 q = p - c;\nq.x *= (1.0 + (b.w - 1.0) * u_stretch) * (1.0 + 0.12 * (sin(t * lf(0.3) + p3) - sin(p3)));\nfloat f = exp(-pow(dot(q, q) / (r * r) + 1e-6, FALLOFF));\nfield += f;\npeak = max(peak, f);\ncyc += f * palAt(float(i));\n}\nfloat sum = field;\nfield = mix(peak, field, u_merge);\nfloat lo = max(0.5 - u_soft * 0.45, 0.0);\nfloat hi = 0.5 + u_soft * 0.45;\nfloat e = smoothstep(lo, hi, field);\nfloat tone = (field - CORE_LO) / (CORE_HI - CORE_LO);\nif (u_mapping > 0.5) {\nfloat c = smoothstep(0.0, 1.0, tone);\nreturn shadeFlat(1.0 - (1.0 - e) * (1.0 - c), cyc / max(sum, 1e-4));\n}\nreturn shade(e, tone);\n}", M = "vec4 patternAt(vec2 frag) {\nfloat aspect = u_res.x / u_res.y;\nvec2 uv = frag / u_res;\nvec2 p = vec2(uv.x * aspect, uv.y);\nvec2 m = vec2(u_mouse.x * aspect, u_mouse.y);\nvec2 d = p - m;\nfloat fall = exp(-dot(d, d) / u_cursorR) * u_active;\nif (u_cursorMode < 0.5) {\np += d * fall * 0.9 * u_pull;\n} else {\nfloat a = u_pull * fall * 2.5;\np = m + mat2(cos(a), sin(a), -sin(a), cos(a)) * d;\n}\np -= vec2(u_vel.x * aspect, u_vel.y) * fall * u_smear;\nreturn shapeColor(p, u_time);\n}\nfloat fadeAt(vec2 frag) {\nreturn u_opacity * (1.0 - smoothstep(0.55, 1.0, length(frag / u_res - 0.5)) * u_fade);\n}", N = "vec4 over(vec4 top, vec4 under) { return top + under * (1.0 - top.a); }\nmat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }\nvec4 shadeInstance(float d, float soft, float aa, float idx) {\nfloat s = max(soft, aa);\nfloat cov = 1.0 - smoothstep(1.0 - s, 1.0 + s, d);\nif (u_mapping > 0.5) return shadeFlat(cov, palAt(idx));\nreturn shade(cov, 1.0 - d);\n}\nvoid flatten(vec4 P) { g_cov = P.a; g_flat = P.rgb / max(P.a, 1e-4); g_isFlat = 1.0; }", P = "uniform float u_wCount; uniform float u_wAmp; uniform float u_wK; uniform float u_wHalf;\nuniform float u_wSoft; uniform float u_wSpread; uniform float u_wTwist; uniform float u_wAngle;\nuniform float u_wTravel;\nuniform vec4 u_wave[8];\nvec4 shapeColor(vec2 p, float t) {\nfloat aspect = u_res.x / u_res.y;\nvec2 q = rot2(-u_wAngle) * (p - vec2(0.5 * aspect, 0.5));\nfloat aa = 1.0 / (u_res.y * u_wHalf);\nvec4 P = vec4(0.0);\nfor (int i = 0; i < 8; i++) {\nif (float(i) >= u_wCount) break;\nvec4 w = u_wave[i];\nfloat base = (float(i) - (u_wCount - 1.0) * 0.5) * u_wSpread;\nfloat ph0 = w.x + float(i) * u_wTwist;\nfloat ph = ph0 + t * lf(w.y) * u_wTravel;\nfloat ph2 = w.w + ph0 * 0.7 + t * lf(0.7 * w.y) * u_wTravel;\nfloat a2 = u_wAmp * w.z * 0.35;\nfloat x = q.x * u_wK;\nfloat y = base + u_wAmp * sin(x + ph) + a2 * sin(2.0 * x + ph2);\nfloat dy = u_wK * (u_wAmp * cos(x + ph) + 2.0 * a2 * cos(2.0 * x + ph2));\nfloat d = abs(q.y - y) / sqrt(1.0 + dy * dy) / u_wHalf;\nP = over(shadeInstance(d, u_wSoft, aa, float(i)), P);\n}\nflatten(P);\nreturn P;\n}", F = "uniform float u_kCount; uniform float u_kAngle; uniform float u_kHalf; uniform float u_kSoft;\nuniform float u_kWarp; uniform float u_kWarpFreq; uniform vec2 u_kSeed;\nvec4 shapeColor(vec2 p, float t) {\nfloat aspect = u_res.x / u_res.y;\nvec2 n = vec2(-sin(u_kAngle), cos(u_kAngle));\nfloat s = dot(p - vec2(0.5 * aspect, 0.5), n);\ns += u_kWarp * (fbm(p * u_kWarpFreq + u_kSeed + drift(vec2(0.12), t), 3.0) - 0.5);\nfloat x = s * u_kCount - t * lr(dot(u_flow, n) * u_kCount);\nfloat i = floor(x);\nfloat f = fract(x) - 0.5;\nfloat aa = u_kCount / (u_res.y * u_kHalf);\nfloat j = i + (f > 0.0 ? 1.0 : -1.0);\nvec4 near = shadeInstance((1.0 - abs(f)) / u_kHalf, u_kSoft, aa, j);\nvec4 P = shadeInstance(abs(f) / u_kHalf, u_kSoft, aa, i);\nfloat cov = g_cov;\nP = over(P, near);\ng_cov = max(cov, P.a);\nreturn P;\n}", I = "uniform float u_rCount; uniform float u_rSpacing; uniform float u_rThick; uniform float u_rSoft;\nuniform float u_rSources; uniform float u_rDist; uniform vec2 u_rCenter;\nuniform vec2 u_rSrc[3];\nvec4 shapeColor(vec2 p, float t) {\nfloat aspect = u_res.x / u_res.y;\nvec2 dr = drift(u_flow * 1.6, t);\nif (u_rDist > 0.0) p += u_rDist * (vec2(fbm(p * 2.5 + dr, 3.0), fbm(p * 2.5 + 9.1 - dr, 3.0)) - 0.5);\nfloat r0 = length(p - vec2(u_rCenter.x * aspect, u_rCenter.y));\nfloat speed = lr(0.4);\nfloat phase = r0 / u_rSpacing - t * speed;\nfloat v = cos(6.2831853 * phase);\nfloat rmin = r0;\nfor (int k = 1; k < 3; k++) {\nif (float(k) >= u_rSources) break;\nfloat r = length(p - vec2(u_rSrc[k].x * aspect, u_rSrc[k].y));\nv += cos(6.2831853 * (r / u_rSpacing - t * speed));\nrmin = min(rmin, r);\n}\nfloat between = acos(clamp(v / u_rSources, -1.0, 1.0)) / 3.14159265;\nfloat aa = 2.0 / (u_rSpacing * u_res.y * u_rThick);\nvec4 P = shadeInstance(between / u_rThick, u_rSoft, aa, floor(phase + 0.5));\nfloat vis = 1.0 - smoothstep(u_rCount - 0.5, u_rCount + 0.5, rmin / u_rSpacing);\ng_cov *= vis;\nreturn P * vis;\n}", L = "uniform float u_oSpacing; uniform float u_oSize; uniform float u_oSoft; uniform float u_oHex;\nuniform float u_oJitter; uniform float u_oMod; uniform vec2 u_oSeed;\nvec2 jitter(vec2 id) {\nreturn vec2(hash(dot(id, vec2(12.37, 45.61))), hash(dot(id, vec2(78.93, 10.17)))) - 0.5;\n}\nvec4 dotAt(vec2 p, vec2 center, vec2 id, float sp, float t) {\ncenter += jitter(id) * u_oJitter * sp * 0.5;\nfloat n = fbm(center * 1.8 + u_oSeed - drift(u_flow * 2.0, t), 2.0);\nfloat m = mix(1.0, smoothstep(0.3, 0.72, n), u_oMod);\nfloat r = u_oSize * 0.5 * sp * m;\nif (r < 1e-5) return vec4(0.0);\nfloat aa = 1.0 / (u_res.y * r);\nfloat d = length(p - center) / r;\nfloat s = max(u_oSoft, aa);\nfloat cov = 1.0 - smoothstep(1.0 - s, 1.0 + s, d);\nif (u_mapping > 0.5) return shadeFlat(cov, palAt(floor(hash(dot(id, vec2(3.1, 7.7))) * u_palN)));\nreturn shade(cov, min(m, 1.0 - d));\n}\nvec4 shapeColor(vec2 p, float t) {\nfloat sp = u_oSpacing * u_dpr / u_res.y;\nvec4 P = vec4(0.0);\nbool near = u_oJitter == 0.0 && u_oSize * 0.5 * (1.0 + u_oSoft) <= 0.5;\nif (near) {\nif (u_oHex < 0.5) {\nvec2 id = floor(p / sp);\nP = dotAt(p, (id + 0.5) * sp, id, sp, t);\n} else {\nvec2 a = vec2(1.0, 1.7320508) * sp;\nvec2 id1 = floor(p / a);\nvec2 id2 = floor(p / a + 0.5);\nP = over(dotAt(p, (id1 + 0.5) * a, id1 * 2.0, sp, t), dotAt(p, id2 * a, id2 * 2.0 + 1.0, sp, t));\n}\n} else if (u_oHex < 0.5) {\nif (u_oJitter > 0.0) {\nvec2 id = floor(p / sp);\nfor (int j = -1; j <= 1; j++)\nfor (int i = -1; i <= 1; i++) {\nvec2 c = id + vec2(float(i), float(j));\nP = over(dotAt(p, (c + 0.5) * sp, c, sp, t), P);\n}\n} else {\nvec2 id = floor(p / sp - 0.5);\nfor (int j = 0; j <= 1; j++)\nfor (int i = 0; i <= 1; i++) {\nvec2 c = id + vec2(float(i), float(j));\nP = over(dotAt(p, (c + 0.5) * sp, c, sp, t), P);\n}\n}\n} else {\nvec2 a = vec2(1.0, 1.7320508) * sp;\nvec2 id1 = floor(p / a - 0.5);\nvec2 id2 = floor(p / a);\nfor (int j = 0; j <= 1; j++)\nfor (int i = 0; i <= 1; i++) {\nvec2 o = vec2(float(i), float(j));\nP = over(dotAt(p, (id1 + o + 0.5) * a, (id1 + o) * 2.0, sp, t), P);\nP = over(dotAt(p, (id2 + o) * a, (id2 + o) * 2.0 + 1.0, sp, t), P);\n}\n}\nflatten(P);\nreturn P;\n}", R = "uniform float u_nN; uniform float u_nM; uniform float u_nHalf; uniform float u_nSoft;\nuniform float u_nScale; uniform float u_nRegions;\nvec4 shapeColor(vec2 p, float t) {\nfloat aspect = u_res.x / u_res.y;\nfloat unit = 0.5 * u_nScale;\nvec2 x = (p - vec2(0.5 * aspect, 0.5)) / unit;\nfloat a = 3.14159265 * u_nN, b = 3.14159265 * u_nM;\nfloat ct = cos(t * lf(0.5)), st = sin(t * lf(0.5));\nfloat cax = cos(a * x.x), sax = sin(a * x.x), cby = cos(b * x.y), sby = sin(b * x.y);\nfloat cbx = cos(b * x.x), sbx = sin(b * x.x), cay = cos(a * x.y), say = sin(a * x.y);\nfloat f = ct * (cax * cby - cbx * cay) + st * (sax * sby - sbx * say);\nvec2 g = ct * vec2(-a * sax * cby + b * sbx * cay, -b * cax * sby + a * cbx * say)\n+ st * vec2(a * cax * sby - b * cbx * say, b * sax * cby - a * sbx * cay);\nfloat dist = f / max(length(g), 1e-3);\nfloat aa = 1.0 / (u_res.y * unit * u_nHalf);\nif (u_nRegions > 0.5) {\nfloat d = 1.0 - dist / u_nHalf;\nreturn shadeInstance(max(d, 0.0), u_nSoft, aa, step(0.0, f));\n}\nreturn shadeInstance(abs(dist) / u_nHalf, u_nSoft, aa, 0.0);\n}", z = "#define TEX_OVERLAY\nvec3 texSignal(vec2 frag, float t) {\nvec2 c = (floor(frag / u_texScale) + 0.5) * u_texScale;\nfloat seed = u_texAnimated > 0.5 ? fract(t) : 0.0;\nfloat n = dot(c, vec2(12.9898, 78.233));\nfloat g = contrastCurve(hash(n + seed) - 0.5);\nif (u_texMono > 0.5) return vec3(g * u_texIntensity);\nfloat gg = contrastCurve(hash(n + seed + 17.13) - 0.5);\nfloat gb = contrastCurve(hash(n + seed + 41.71) - 0.5);\nreturn vec3(g, gg, gb) * u_texIntensity;\n}", B = "#define TEX_OVERLAY\nvec3 texSignal(vec2 frag, float t) {\nvec2 p = frag / (u_texScale * 24.0 * u_dpr);\nvec2 dn = u_texAnimated > 0.5 ? -drift(u_flow * 10.0, t) : vec2(0.0);\nfloat g = contrastCurve(fbm(p + dn, u_texOctaves) - 0.5);\nif (u_texMono > 0.5) return vec3(g * u_texIntensity);\nfloat gg = contrastCurve(fbm(p + dn + 31.7, u_texOctaves) - 0.5);\nfloat gb = contrastCurve(fbm(p + dn + 57.3, u_texOctaves) - 0.5);\nreturn vec3(g, gg, gb) * u_texIntensity;\n}", V = "#define TEX_OVERLAY\nvec3 texSignal(vec2 frag, float t) {\nvec2 p = frag / (u_texScale * 6.0 * u_dpr);\nfloat tooth = fbm(p, u_texOctaves);\nfloat relief = tooth - fbm(p + vec2(0.4, 0.4), u_texOctaves);\nfloat fib = 0.0;\nfor (int i = 0; i < 3; i++) {\nfloat a = float(i) * 2.1 + 0.4;\nvec2 q = mat2(cos(a), sin(a), -sin(a), cos(a)) * p * 0.35;\nfib += smoothstep(0.62, 0.9, noise(vec2(q.x * 0.25, q.y * 7.0) + float(i) * 13.0));\n}\nfloat g = relief * 1.4 + (tooth - 0.5) * 0.35 - fib * u_texFibers * 0.35;\nreturn vec3(contrastCurve(g) * u_texIntensity);\n}", H = "#define TEX_SCREEN\nfloat bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }\nfloat bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }\nfloat bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }\nfloat threshold(vec2 frag) {\nvec2 c = floor(frag / u_texScale);\nif (u_texMatrix < 0.5) return bayer4(c) + 0.5 / 16.0;\nif (u_texMatrix < 1.5) return bayer8(c) + 0.5 / 64.0;\nfloat o = u_texAnimated > 0.5 ? floor(fract(u_time) * 64.0) * 5.588238 : 0.0;\nreturn fract(52.9829189 * fract(dot(c + o, vec2(0.06711056, 0.00583715))));\n}\nvec4 screenPattern(vec2 frag) {\nvec4 P = patternAt(frag);\nfloat k = fadeAt(frag);\nfloat thr = threshold(frag);\nfloat cov = g_cov * k;\nfloat on = step(thr, contrastCurve(cov - 0.5) + 0.5);\nvec4 D;\nif (g_isFlat > 0.5) {\nD = shadeFlat(1.0, g_flat);\n} else {\nfloat L = u_texLevels - 1.0;\nfloat tone = floor(clamp(g_tone, 0.0, 1.0) * L + thr) / L;\nD = shade(1.0, tone);\n}\nreturn mix(P * k, D * on, u_texIntensity);\n}", U = "#define TEX_SCREEN\nvec4 screenPattern(vec2 frag) {\nfloat cell = u_texScale * 6.0 * u_dpr;\nfloat ca = cos(u_texAngle), sa = sin(u_texAngle);\nmat2 rot = mat2(ca, sa, -sa, ca);\nvec2 q = rot * frag / cell;\nvec2 id = floor(q) + 0.5;\nvec2 center = (id * cell) * rot;\nvec2 local = (q - id) * cell;\nvec4 C = patternAt(center);\nvec3 centerCol = C.a > 1e-4 ? C.rgb / C.a : u_pal[0];\nfloat a = clamp(g_cov * fadeAt(center), 0.0, 1.0);\na = clamp(contrastCurve(a - 0.5) + 0.5, 0.0, 1.0);\nfloat dist, r;\nif (u_texDotShape < 0.5) { dist = length(local); r = sqrt(a) * 0.7072 * cell; }\nelse if (u_texDotShape < 1.5) { dist = abs(local.y); r = a * 0.5 * cell; }\nelse { dist = max(abs(local.x), abs(local.y)); r = sqrt(a) * 0.5 * cell; }\nfloat mask = (1.0 - smoothstep(r - 0.75, r + 0.75, dist)) * step(1e-3, a);\nvec4 P = patternAt(frag);\nvec3 col = mix(centerCol, P.rgb / max(P.a, 1e-4), smoothstep(0.02, 0.2, P.a));\nvec4 H = vec4(col * mask, mask);\nreturn mix(P * fadeAt(frag), H, u_texIntensity);\n}", W = "vec3 background(vec2 frag) {\nif (u_bgType < 0.5) return u_bg[0];\nfloat t;\nif (u_bgKind < 0.5) {\nvec2 d = vec2(sin(u_bgAngle), cos(u_bgAngle));\nfloat len = abs(u_res.x * d.x) + abs(u_res.y * d.y);\nt = 0.5 + dot(frag - 0.5 * u_res, d) / len;\n} else {\nvec2 c = u_bgCenter * u_res;\nt = length(frag - c) / length(max(c, u_res - c));\n}\nt = clamp(t, 0.0, 1.0);\nvec3 col = u_bgN < 2.5 ? mix(u_bg[0], u_bg[1], t)\n: (t < 0.5 ? mix(u_bg[0], u_bg[1], t * 2.0) : mix(u_bg[1], u_bg[2], t * 2.0 - 1.0));\nreturn col + (hash(dot(frag, vec2(7.13, 157.1))) - 0.5) / 255.0;\n}\nvec3 blendMode(vec3 b, vec3 s) {\nif (u_blend < 1.5) return b * s;\nif (u_blend < 2.5) return 1.0 - (1.0 - b) * (1.0 - s);\nif (u_blend < 3.5) return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, b));\nif (u_blend < 4.5) {\nvec3 d = mix(((16.0 * b - 12.0) * b + 4.0) * b, sqrt(b), step(0.25, b));\nreturn mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (d - b), step(0.5, s));\n}\nreturn abs(b - s);\n}\nvoid main() {\nvec2 frag = gl_FragCoord.xy;\n#ifdef TEX_SCREEN\nvec4 P = screenPattern(frag);\n#else\nvec4 P = patternAt(frag) * fadeAt(frag);\n#endif\n#ifdef TEX_OVERLAY\nvec3 s = texSignal(frag, u_time);\nif (u_texTarget > 0.5) { P.rgb = clamp(P.rgb + s * P.a, 0.0, P.a); s = vec3(0.0); }\n#else\nvec3 s = vec3(0.0);\n#endif\nif (u_bgType > 1.5) {\nfloat a = abs(s.r);\nvec4 speck = vec4(vec3(step(0.0, s.r)) * a, a);\ngl_FragColor = speck + P * (1.0 - a);\nreturn;\n}\nvec3 b = background(frag);\nvec3 col = b * (1.0 - P.a) + P.rgb;\nif (u_blend > 0.5) {\nvec3 src = clamp(P.rgb / max(P.a, 1e-4), 0.0, 1.0);\ncol = b * (1.0 - P.a) + P.a * blendMode(b, src);\n}\ngl_FragColor = vec4(col + s, 1.0);\n}", G = {
	blobs: j,
	waves: N + P,
	bands: N + F,
	rings: N + I,
	dots: N + L,
	nodal: N + R
}, le = {
	none: "",
	grain: z,
	noise: B,
	paper: V,
	dither: H,
	halftone: U
};
function ue(e, t) {
	return `${e}|${t}`;
}
function de(e, t) {
	return [
		se,
		ce,
		G[e],
		M,
		le[t],
		W
	].join("\n");
}
function K(e) {
	let t = Math.imul(Math.round(e * 1e3) | 0, 2654435761) ^ 2246822507;
	return () => {
		t = t + 1831565813 | 0;
		let e = t;
		return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
function q(e, { satellite: t = !0 } = {}) {
	let n = K(e), r = (e, t) => e + (t - e) * n(), i = () => n() < .5 ? -1 : 1, a = (e, t) => ({
		f1: r(.3, .8),
		f2: r(.3, .8),
		amp: r(e, t),
		phase: r(0, Math.PI * 2)
	}), o = {
		x: r(.3, .7),
		y: r(.35, .65),
		r: r(.22, .32),
		fx: r(.75, 1.35),
		...a(.04, .09)
	}, s = {
		x: o.x + i() * r(.05, .16),
		y: o.y + i() * r(.06, .2),
		r: r(.16, .26),
		fx: r(.5, 1.3),
		...a(.04, .09)
	}, c = r(0, Math.PI * 2), l = r(.18, .3), u = [
		o,
		s,
		{
			x: o.x + Math.cos(c) * l,
			y: o.y + Math.sin(c) * l,
			r: r(.045, .085),
			fx: r(.9, 1.1),
			...a(.06, .12)
		}
	];
	for (; u.length < 7;) u.push({
		x: r(.2, .8),
		y: r(.2, .8),
		r: r(.08, .24),
		fx: r(.7, 1.3),
		...a(.05, .12)
	});
	return t || u.splice(2, 1), u.slice(0, 6);
}
function fe(e) {
	let t = K(e + .101), n = /* @__PURE__ */ new Float32Array(32);
	for (let e = 0; e < 8; e++) n.set([
		t() * Math.PI * 2,
		.6 + t() * .6,
		.3 + t() * .7,
		t() * Math.PI * 2
	], e * 4);
	return n;
}
function pe(e) {
	let t = K(e + .202), n = /* @__PURE__ */ new Float32Array(6);
	for (let e = 1; e < 3; e++) n.set([.15 + t() * .7, .15 + t() * .7], e * 2);
	return n;
}
function me(e) {
	let t = K(e + .303);
	return [t() * 100, t() * 100];
}
function he(e) {
	let t = /* @__PURE__ */ new Float32Array(24), n = /* @__PURE__ */ new Float32Array(24);
	return e.forEach((e, r) => {
		t.set([
			e.x,
			e.y,
			e.r,
			e.fx
		], r * 4), n.set([
			e.f1,
			e.f2,
			e.amp,
			e.phase
		], r * 4);
	}), {
		blob: t,
		orbit: n
	};
}
//#endregion
//#region src/uniforms.ts
var ge = .91, _e = .02, ve = 2.16, ye = {
	none: 0,
	grain: .07,
	noise: .22,
	paper: .16,
	halftone: 1,
	dither: 1
}, be = .045, xe = 1.6, J = .06, Se = 5, Ce = [
	"normal",
	"multiply",
	"screen",
	"overlay",
	"soft-light",
	"difference"
], Y = (e, t) => {
	let r = new Float32Array(t * 3);
	return e.slice(0, t).forEach((e, t) => r.set(n(e), t * 3)), r;
}, X = null;
function we(e, t) {
	let n = `${e}|${t}`;
	return X?.key !== n && (X = {
		key: n,
		packed: he(q(e, { satellite: t }))
	}), X.packed;
}
var Z = (e) => e * Math.PI / 180, Q = (e, t, n) => e + (t - e) * n;
function Te(e) {
	let t = e.background, n = t.type === "gradient" ? t.gradient : [t.color], r = we(e.seed, e.blobs.satellite), { waves: i, bands: a, rings: o, dots: s, nodal: c } = e, l = me(e.seed), u = c.m === c.n ? c.n < 12 ? c.n + 1 : c.n - 1 : c.m, d = e.texture;
	return {
		u_pull: e.cursor.mode === "off" ? 0 : (e.cursor.mode === "pull" ? -1 : 1) * (e.cursor.strength / 100),
		u_cursorMode: +(e.cursor.mode === "swirl"),
		u_cursorR: be * 4 ** ((e.cursor.radius - 50) / 50),
		u_smear: e.cursor.mode === "off" ? 0 : xe * (e.cursor.smear / 50),
		u_period: e.motion.loop > 0 && e.motion.speed > 0 ? e.motion.loop * e.motion.speed : 0,
		u_flow: [Math.cos(Z(e.motion.direction)) * J, -Math.sin(Z(e.motion.direction)) * J],
		u_pal: Y(e.color.palette, Se),
		u_palN: e.color.palette.length,
		u_mapping: +(e.color.mapping === "cycle"),
		u_steps: e.color.steps,
		u_blend: Ce.indexOf(e.color.blend),
		u_opacity: e.color.opacity / 100,
		u_fade: e.color.fade / 100,
		u_bgType: t.type === "solid" ? 0 : t.type === "gradient" ? 1 : 2,
		u_bg: Y(n, 3),
		u_bgN: n.length,
		u_bgKind: +(t.kind === "radial"),
		u_bgAngle: t.angle * Math.PI / 180,
		u_bgCenter: [t.centerX / 100, 1 - t.centerY / 100],
		u_texIntensity: d.intensity / 100 * ye[d.type],
		u_texScale: Math.round(d.scale),
		u_texGamma: 2 ** ((50 - d.contrast) / 25),
		u_texAnimated: +!!d.animated,
		u_texTarget: +(d.target === "pattern"),
		u_texMono: +!!d.mono,
		u_texOctaves: d.octaves,
		u_texAngle: d.angle * Math.PI / 180,
		u_texDotShape: [
			"dot",
			"line",
			"square"
		].indexOf(d.dotShape),
		u_texMatrix: [
			"bayer4",
			"bayer8",
			"ign"
		].indexOf(d.matrix),
		u_texLevels: d.levels,
		u_texFibers: d.fibers / 100,
		u_count: e.blobs.count,
		u_size: e.blobs.size / 100 * ge,
		u_soft: _e + e.blobs.softness / 100 * ve,
		u_blob: r.blob,
		u_orbit: r.orbit,
		u_stretch: e.blobs.stretch / 100,
		u_merge: e.blobs.merge / 100,
		u_wobble: e.blobs.wobble / 100 * .07,
		u_wCount: i.count,
		u_wAmp: i.amplitude / 100 * .3,
		u_wK: Math.PI * 2 / Q(.3, 3, i.wavelength / 100),
		u_wHalf: i.thickness / 100 * .2,
		u_wSoft: i.softness / 100,
		u_wSpread: Q(.03, .3, i.spread / 100),
		u_wTwist: i.twist / 100 * Math.PI,
		u_wAngle: Z(i.angle),
		u_wTravel: Math.cos(Z(e.motion.direction) + Z(i.angle)) >= 0 ? 1 : -1,
		u_wave: fe(e.seed),
		u_kCount: a.count,
		u_kAngle: Z(a.angle),
		u_kHalf: a.width / 200,
		u_kSoft: a.softness / 100,
		u_kWarp: a.warp / 100 * .3,
		u_kWarpFreq: Q(.5, 6, a.warpScale / 100),
		u_kSeed: l,
		u_rCount: o.count,
		u_rSpacing: o.spacing / 100 * .25,
		u_rThick: o.thickness / 100,
		u_rSoft: o.softness / 100,
		u_rSources: o.sources,
		u_rDist: o.distortion / 100 * .25,
		u_rCenter: [o.centerX / 100, 1 - o.centerY / 100],
		u_rSrc: pe(e.seed),
		u_oSpacing: s.spacing,
		u_oSize: s.size / 100,
		u_oSoft: s.softness / 100,
		u_oHex: +(s.grid === "hex"),
		u_oJitter: s.jitter / 100,
		u_oMod: s.modulation / 100,
		u_oSeed: l,
		u_nN: c.n,
		u_nM: u,
		u_nHalf: c.thickness / 100 * .12,
		u_nSoft: c.softness / 100,
		u_nScale: c.scale / 100,
		u_nRegions: +(c.style === "regions")
	};
}
function Ee(e) {
	let t = e.background;
	if (t.type === "transparent") return "transparent";
	if (t.type === "solid") return t.color;
	let n = t.gradient.join(", ");
	return t.kind === "linear" ? `linear-gradient(${t.angle}deg, ${n})` : `radial-gradient(circle farthest-corner at ${t.centerX}% ${t.centerY}%, ${n})`;
}
//#endregion
//#region src/renderer.ts
var De = 37297;
function Oe(e, t, n = {}) {
	let r = {
		antialias: !1,
		alpha: !0,
		premultipliedAlpha: !0,
		depth: !1,
		stencil: !1,
		powerPreference: "low-power",
		preserveDrawingBuffer: n.preserveDrawingBuffer ?? !1
	}, i = e.getContext("webgl2", r) ?? e.getContext("webgl", r);
	if (!i) return null;
	let a = i, o = n.sync ? null : a.getExtension("KHR_parallel_shader_compile"), s = a.createBuffer();
	a.bindBuffer(a.ARRAY_BUFFER, s), a.bufferData(a.ARRAY_BUFFER, new Float32Array([
		-1,
		-1,
		3,
		-1,
		-1,
		3
	]), a.STATIC_DRAW);
	let c = /* @__PURE__ */ new Map(), l = null, u = null, d = {}, f = $(a, a.VERTEX_SHADER, oe);
	function p(e, t) {
		let n = $(a, a.FRAGMENT_SHADER, t), r = a.createProgram();
		a.attachShader(r, f), a.attachShader(r, n), a.bindAttribLocation(r, 0, "a_pos"), a.linkProgram(r);
		let i = {
			program: r,
			fs: n,
			linked: !1,
			failed: !1,
			uniforms: []
		};
		return c.set(e, i), i;
	}
	function m(e) {
		if (e.linked) return !0;
		if (e.failed || o && !a.getProgramParameter(e.program, De)) return !1;
		let t = e.fs;
		if (e.fs = null, !a.getProgramParameter(e.program, a.LINK_STATUS)) return a.isContextLost() || console.error("[lazuli] Shader failed to build:", t && a.getShaderInfoLog(t) || a.getProgramInfoLog(e.program)), t && a.deleteShader(t), e.failed = !0, !1;
		t && a.deleteShader(t);
		let n = a.getProgramParameter(e.program, a.ACTIVE_UNIFORMS);
		for (let t = 0; t < n; t++) {
			let n = a.getActiveUniform(e.program, t), r = n.name.replace(/\[0\]$/, "");
			e.uniforms.push({
				name: r,
				loc: a.getUniformLocation(e.program, n.name),
				type: n.type
			});
		}
		return e.linked = !0, !0;
	}
	function h(e, t) {
		a.useProgram(e.program);
		for (let n of e.uniforms) {
			let e = t[n.name];
			e !== void 0 && ke(a, n.loc, n.type, e);
		}
	}
	function g(e) {
		l = e, h(e, d);
	}
	let _ = {
		gl: a,
		setConfig(e) {
			d = Te(e);
			let t = ue(e.shape.type, e.texture.type), n = c.get(t) ?? p(t, de(e.shape.type, e.texture.type));
			u = n, m(n) ? g(n) : l && h(l, d);
		},
		draw(e) {
			if (u && u !== l && m(u) && g(u), !l) return !1;
			let t = a.drawingBufferWidth, n = a.drawingBufferHeight;
			return a.viewport(0, 0, t, n), a.bindBuffer(a.ARRAY_BUFFER, s), a.enableVertexAttribArray(0), a.vertexAttribPointer(0, 2, a.FLOAT, !1, 0, 0), h(l, {
				u_res: [t, n],
				u_time: e.time,
				u_mouse: e.mouse,
				u_vel: e.vel,
				u_active: e.active,
				u_dpr: e.dpr
			}), a.drawArrays(a.TRIANGLES, 0, 3), !0;
		},
		get pending() {
			return !!u && u !== l && !u.failed;
		},
		destroy() {
			for (let e of c.values()) a.deleteProgram(e.program);
			c.clear(), a.deleteShader(f), a.deleteBuffer(s), a.getExtension("WEBGL_lose_context")?.loseContext();
		}
	};
	return _.setConfig(t), u && u.failed ? null : _;
}
function ke(e, t, n, r) {
	let i = typeof r == "number" ? [r] : r;
	switch (n) {
		case e.FLOAT: return e.uniform1fv(t, i);
		case e.FLOAT_VEC2: return e.uniform2fv(t, i);
		case e.FLOAT_VEC3: return e.uniform3fv(t, i);
		case e.FLOAT_VEC4: return e.uniform4fv(t, i);
		case e.INT:
		case e.BOOL:
		case e.SAMPLER_2D: return e.uniform1iv(t, Array.from(i, Math.round));
	}
}
function $(e, t, n) {
	let r = e.createShader(t);
	return e.shaderSource(r, n), e.compileShader(r), r;
}
//#endregion
export { r as _, ae as a, t as b, T as c, v as d, m as f, g, _ as h, D as i, w as l, h as m, Ee as n, A as o, y as p, q as r, re as s, Oe as t, ie as u, i as v, a as y };

//# sourceMappingURL=core.js.map