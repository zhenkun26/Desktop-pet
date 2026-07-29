import { api } from "../shared/api";
import type { Bubble } from "./bubble";

type PetState = "idle" | "drag" | "click" | "busy";

const DRAG_THRESHOLD = 4; // 像素，超过此距离视为拖拽

const IDLE_LINES = [
  "哎嘿～有什么事吗？",
  "本堂主今天精神不错！",
  "嘿嘿，旅行者又来找我啦？",
  "往生堂今日营业中～",
  "哎呀呀，今天的天气真不错呢",
];

export class PetController {
  private image: HTMLImageElement;
  private bubble: Bubble;
  private state: PetState = "idle";
  private busyOverride: boolean = false;

  // 拖拽状态
  private dragStartX = 0;
  private dragStartY = 0;
  private lastScreenX = 0;
  private lastScreenY = 0;
  private isDragging = false;
  private moved = false;

  constructor(image: HTMLImageElement, bubble: Bubble) {
    this.image = image;
    this.bubble = bubble;
    this.bindEvents();
    this.setState("idle");
  }

  private bindEvents(): void {
    this.image.addEventListener("pointerdown", this.onPointerDown);
    this.image.addEventListener("contextmenu", this.onContextMenu);
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return; // 仅左键
    e.preventDefault();
    this.dragStartX = e.screenX;
    this.dragStartY = e.screenY;
    this.lastScreenX = e.screenX;
    this.lastScreenY = e.screenY;
    this.moved = false;
    this.isDragging = true;

    try {
      this.image.setPointerCapture(e.pointerId);
    } catch {
      // 忽略
    }

    this.image.addEventListener("pointermove", this.onPointerMove);
    this.image.addEventListener("pointerup", this.onPointerUp);
    this.image.addEventListener("pointercancel", this.onPointerUp);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDragging) return;

    const dx = e.screenX - this.dragStartX;
    const dy = e.screenY - this.dragStartY;

    if (!this.moved && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
      this.moved = true;
      if (this.state !== "busy") this.setState("drag");
    }

    if (this.moved) {
      const moveX = e.screenX - this.lastScreenX;
      const moveY = e.screenY - this.lastScreenY;
      this.lastScreenX = e.screenX;
      this.lastScreenY = e.screenY;
      void api.moveWindow(moveX, moveY);
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.isDragging) return;
    this.isDragging = false;

    try {
      this.image.releasePointerCapture(e.pointerId);
    } catch {
      // 忽略
    }

    this.image.removeEventListener("pointermove", this.onPointerMove);
    this.image.removeEventListener("pointerup", this.onPointerUp);
    this.image.removeEventListener("pointercancel", this.onPointerUp);

    if (this.moved) {
      // 拖拽结束，保存位置
      if (this.state !== "busy") this.setState("idle");
      void api.savePosition();
    } else {
      // 单击
      this.handleClick();
    }
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    void api.showContextMenu();
  };

  private handleClick(): void {
    if (this.busyOverride) {
      // busy 中单击仍弹菜单
      this.showMenu();
      return;
    }
    this.setState("click");
    setTimeout(() => {
      if (this.state === "click") this.setState("idle");
    }, 450);
    this.showMenu();
  }

  private showMenu(): void {
    this.bubble.show("想做什么呢？", "normal", {
      actions: [
        { id: "chat", label: "和我聊天" },
        { id: "persona", label: "角色设定" },
        { id: "quit", label: "退出" },
      ],
      onAction: (id) => {
        if (id === "chat") {
          void api.openChat({ view: "chat" });
        } else if (id === "persona") {
          void api.openChat({ view: "persona" });
        } else if (id === "quit") {
          // 退出由 Rust 端托盘处理，这里暂时不实现
        }
      },
    });
  }

  private setState(next: PetState): void {
    if (this.state === next) return;
    this.state = next;
    this.image.classList.remove(
      "state-idle",
      "state-drag",
      "state-click",
      "state-busy"
    );
    this.image.classList.add(`state-${next}`);
  }

  setBusinessState(busy: boolean): void {
    this.busyOverride = busy;
    if (busy) {
      this.setState("busy");
    } else if (this.state === "busy") {
      this.setState("idle");
    }
  }

  say(text: string): void {
    this.bubble.show(text, "normal", { dismissible: true });
  }

  sayBusy(text: string): void {
    this.bubble.show(text, "busy", { persistent: true });
  }

  canShowRandomIdleLine(): boolean {
    return (
      this.state === "idle" &&
      !this.busyOverride &&
      this.bubble.canShowIdleMessage()
    );
  }

  showRandomIdleLine(): void {
    const line = IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)];
    this.say(line);
  }
}
