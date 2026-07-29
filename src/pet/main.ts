import "./style.css";
import { api } from "../shared/api";
import { Bubble } from "./bubble";
import { PetController } from "./pet-controller";

async function bootstrap(): Promise<void> {
  // 构建 DOM
  const app = document.getElementById("app")!;

  const bubbleEl = document.createElement("div");
  bubbleEl.id = "bubble";
  bubbleEl.className = "bubble hidden";
  bubbleEl.setAttribute("role", "status");
  bubbleEl.setAttribute("aria-live", "polite");

  const stage = document.createElement("div");
  stage.className = "pet-stage";

  const image = document.createElement("img");
  image.id = "pet-image";
  image.className = "pet-image state-idle";
  image.alt = "胡桃";
  image.draggable = false;
  image.src = "/hutao.png";

  stage.appendChild(image);
  app.appendChild(bubbleEl);
  app.appendChild(stage);

  const bubble = new Bubble(bubbleEl);
  const pet = new PetController(image, bubble);

  // 加载配置
  const config = await api.getConfig();

  // 欢迎语
  const welcomeLines = [
    "哎嘿！胡桃来啦～",
    "本堂主报到！",
    "旅行者，今天也一起玩吧～",
  ];
  pet.say(welcomeLines[Math.floor(Math.random() * welcomeLines.length)]);

  // 监听配置变更
  const unlistenConfig = await api.onConfigChanged((next) => {
    // 配置变更时可在此处理（如 alwaysOnTop 变化）
    void next;
  });

  // 监听聊天窗口打开请求（聊天窗口内部会处理视图切换，这里不需要额外动作）
  const unlistenChat = await api.onChatOpenOptions((_options) => {
    // 聊天窗口会自行处理视图切换
  });

  // 监听业务状态（AI 流式回复时 busy）
  const unlistenState = await api.onBusinessState((state) => {
    if (state === "busy") {
      pet.setBusinessState(true);
      pet.sayBusy("胡桃正在想…");
    } else {
      pet.setBusinessState(false);
    }
  });

  // 清理
  window.addEventListener("beforeunload", () => {
    unlistenConfig();
    unlistenChat();
    unlistenState();
  });
}

void bootstrap();
