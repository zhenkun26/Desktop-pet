import { defineConfig } from "vite";

// 单入口 index.html，通过 ?window=pet|chat 查询参数动态加载对应模块
// pets-picture/ 作为静态资源目录，hutao.png 可通过 /hutao.png 访问
export default defineConfig({
  root: "src",
  publicDir: "../pets-picture",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
