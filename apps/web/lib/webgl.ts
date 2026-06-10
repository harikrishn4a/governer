/** Returns true when the browser can create a usable WebGL context. */
export function isWebGLAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    if (!gl || !(gl instanceof WebGLRenderingContext || gl instanceof WebGL2RenderingContext)) {
      return false;
    }

    // Sandboxed / GPU-disabled environments may expose a context that cannot render.
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    if (dbg) {
      const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string;
      const vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) as string;
      if (!renderer || renderer === "Disabled" || vendor === "Disabled") return false;
    }

    return gl.getParameter(gl.VERSION) != null;
  } catch {
    return false;
  }
}
