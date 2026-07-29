// 根据 URL 查询参数加载对应窗口模块
const params = new URLSearchParams(window.location.search);
const win = params.get("window") ?? "pet";

if (win === "chat") {
  import("./chat/main");
} else {
  import("./pet/main");
}
