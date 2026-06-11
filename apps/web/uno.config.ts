import { defineConfig, presetWind3 } from "unocss";

export default defineConfig({
  presets: [presetWind3()],
  shortcuts: {
    "workbench-panel": "border border-slate-200 bg-white/95 shadow-sm",
    "focus-ring": "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
  },
  theme: {
    colors: {
      workspace: {
        canvas: "#e7edf5",
        panel: "#f8fafc",
        ink: "#172033"
      }
    }
  }
});
