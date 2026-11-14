import { l as e, t } from "./core.js";
//#region src/capture.ts
async function n(n, i = {}) {
	let a = r(n) ? n : null, o = a ? a.config : e(n), s = i.scale ?? 2, c = a?.canvas.clientWidth || 1280, l = a?.canvas.clientHeight || 832, u = Math.max(1, Math.round(i.width ?? c * s)), d = Math.max(1, Math.round(i.height ?? l * s)), f = document.createElement("canvas");
	f.width = u, f.height = d;
	let p = t(f, o, {
		sync: !0,
		preserveDrawingBuffer: !0
	});
	if (!p) throw Error("[lazuli] WebGL is unavailable, so the image cannot be rendered.");
	let m = p.gl.getParameter(p.gl.MAX_VIEWPORT_DIMS);
	if (u > m[0] || d > m[1]) throw p.destroy(), Error(`[lazuli] ${u}×${d} is larger than this GPU can render (${m[0]}×${m[1]}).`);
	p.draw({
		time: i.time ?? a?.time ?? 0,
		mouse: [.5, .5],
		vel: [0, 0],
		active: 0,
		dpr: i.pixelRatio ?? (i.width ? u / c : s)
	});
	try {
		return await new Promise((e, t) => f.toBlob((n) => n ? e(n) : t(/* @__PURE__ */ Error("[lazuli] The image could not be encoded.")), "image/png"));
	} finally {
		p.destroy();
	}
}
function r(e) {
	return !!e && typeof e == "object" && "canvas" in e && "config" in e && typeof e.set == "function";
}
//#endregion
export { n as snapshot };

//# sourceMappingURL=capture.js.map