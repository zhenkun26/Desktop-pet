import "./style.css";
import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  api,
  type Conversation,
  type Message,
  type PersonaProfile,
  type PersonaProfileFields,
  type ApiKeyStatus,
  type ChatStreamEvent,
} from "../shared/api";

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true,
});

type ViewName = "chat" | "persona" | "settings";

// ===== 应用状态 =====
const state = {
  currentView: "chat" as ViewName,
  conversations: [] as Conversation[],
  currentConversationId: null as string | null,
  messages: [] as Message[],
  streaming: false,
  streamingContent: "",
  streamingConvId: null as string | null,
  persona: null as PersonaProfile | null,
  apiKeyStatus: null as ApiKeyStatus | null,
};

// ===== DOM 构建 =====
function buildLayout(): void {
  const app = document.getElementById("app")!;

  // Tab 栏
  const tabBar = document.createElement("div");
  tabBar.className = "tab-bar";
  tabBar.innerHTML = `
    <button class="tab active" data-view="chat">对话</button>
    <button class="tab" data-view="persona">角色设定</button>
    <button class="tab" data-view="settings">API 设置</button>
  `;

  // 三个视图容器
  const chatView = document.createElement("div");
  chatView.className = "view chat-view active";
  chatView.id = "view-chat";

  const personaView = document.createElement("div");
  personaView.className = "view persona-view";
  personaView.id = "view-persona";

  const settingsView = document.createElement("div");
  settingsView.className = "view settings-view";
  settingsView.id = "view-settings";

  app.append(tabBar, chatView, personaView, settingsView);

  // 绑定 tab 切换
  tabBar.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const view = (tab as HTMLElement).dataset.view as ViewName;
      switchView(view);
    });
  });
}

function switchView(view: ViewName): void {
  state.currentView = view;
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.querySelector(`.tab[data-view="${view}"]`)?.classList.add("active");
  document.getElementById(`view-${view}`)?.classList.add("active");
}

// ===== 对话视图 =====
function buildChatView(): void {
  const view = document.getElementById("view-chat")!;

  // 侧边栏
  const sidebar = document.createElement("div");
  sidebar.className = "sidebar";
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <h3>会话</h3>
      <button class="new-chat-btn" id="new-chat-btn">+ 新建</button>
    </div>
    <div class="conversation-list" id="conversation-list"></div>
  `;

  // 主区域
  const main = document.createElement("div");
  main.className = "chat-main";
  main.innerHTML = `
    <div class="message-area" id="message-area">
      <div class="empty-state">
        <div class="empty-icon">💬</div>
        <div>选择或新建一个会话开始聊天</div>
      </div>
    </div>
    <div class="input-area">
      <textarea id="message-input" placeholder="输入消息... (Enter 发送，Shift+Enter 换行)" rows="1"></textarea>
      <button class="send-btn" id="send-btn" disabled>发送</button>
    </div>
  `;

  view.append(sidebar, main);

  // 绑定事件
  document.getElementById("new-chat-btn")!.addEventListener("click", createNewConversation);
  const input = document.getElementById("message-input") as HTMLTextAreaElement;
  const sendBtn = document.getElementById("send-btn") as HTMLButtonElement;

  input.addEventListener("input", () => {
    sendBtn.disabled = input.value.trim().length === 0 || state.streaming;
    // 自动高度
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendMessage();
    }
  });

  sendBtn.addEventListener("click", sendMessage);
}

async function refreshConversations(): Promise<void> {
  state.conversations = await api.listConversations();
  renderConversationList();
}

function renderConversationList(): void {
  const list = document.getElementById("conversation-list")!;
  list.innerHTML = "";

  if (state.conversations.length === 0) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:#aaa;font-size:12px;">暂无会话</div>';
    return;
  }

  for (const conv of state.conversations) {
    const item = document.createElement("div");
    item.className = "conversation-item";
    if (conv.id === state.currentConversationId) item.classList.add("active");
    item.dataset.convId = conv.id;

    const time = new Date(conv.updatedAt * 1000).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    item.innerHTML = `
      <span class="conv-delete" data-action="delete" title="删除">×</span>
      <span class="conv-rename" data-action="rename" title="重命名">✎</span>
      <div class="conv-title" data-action="title">${escapeHtml(conv.title)}</div>
      <div class="conv-preview">${escapeHtml(conv.lastMessagePreview || time)}</div>
    `;

    item.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.action === "delete") {
        e.stopPropagation();
        deleteConversation(conv.id);
      } else if (target.dataset.action === "rename") {
        e.stopPropagation();
        startRenameConversation(conv.id, conv.title, item);
      } else {
        selectConversation(conv.id);
      }
    });

    // 双击标题重命名
    const titleEl = item.querySelector('[data-action="title"]');
    titleEl?.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      startRenameConversation(conv.id, conv.title, item);
    });

    list.appendChild(item);
  }
}

async function createNewConversation(): Promise<void> {
  const conv = await api.createConversation();
  state.currentConversationId = conv.id;
  state.messages = [];
  await refreshConversations();
  renderMessages();
}

async function deleteConversation(convId: string): Promise<void> {
  await api.deleteConversation(convId);
  if (state.currentConversationId === convId) {
    state.currentConversationId = null;
    state.messages = [];
    renderMessages();
  }
  await refreshConversations();
}

function startRenameConversation(
  convId: string,
  currentTitle: string,
  item: HTMLElement
): void {
  const titleEl = item.querySelector(".conv-title") as HTMLElement;
  if (!titleEl) return;

  const input = document.createElement("input");
  input.type = "text";
  input.value = currentTitle;
  input.className = "conv-rename-input";
  input.style.cssText =
    "width:100%;border:1px solid #e8633a;border-radius:4px;padding:2px 4px;font-size:13px;font-family:inherit;outline:none;";

  titleEl.replaceWith(input);
  input.focus();
  input.select();

  const save = async () => {
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== currentTitle) {
      await api.renameConversation(convId, newTitle);
      await refreshConversations();
    } else {
      renderConversationList();
    }
  };

  input.addEventListener("blur", save);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    } else if (e.key === "Escape") {
      renderConversationList();
    }
  });
}

async function selectConversation(convId: string): Promise<void> {
  state.currentConversationId = convId;
  state.messages = await api.getConversationMessages(convId);
  renderConversationList();
  renderMessages();
}

function renderMessages(): void {
  const area = document.getElementById("message-area")!;

  if (state.messages.length === 0 && !state.streaming) {
    area.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💬</div>
        <div>开始和胡桃聊天吧～</div>
      </div>
    `;
    return;
  }

  area.innerHTML = "";
  for (const msg of state.messages) {
    area.appendChild(renderMessage(msg));
  }

  // 流式中的临时气泡
  if (state.streaming && state.streamingConvId === state.currentConversationId) {
    const tempMsg: Message = {
      id: "streaming",
      conversationId: state.currentConversationId || "",
      role: "assistant",
      content: state.streamingContent,
      createdAt: Date.now(),
      status: "ok",
      errorCode: null,
    };
    area.appendChild(renderMessage(tempMsg));
  }

  // 自动滚动到底部
  area.scrollTop = area.scrollHeight;
}

function renderMessage(msg: Message): HTMLElement {
  const div = document.createElement("div");

  if (msg.status === "error") {
    div.className = "message error";
    div.textContent = `⚠ ${msg.errorCode || "错误"}: ${msg.content || "生成失败"}`;
    return div;
  }

  div.className = `message ${msg.role}`;

  if (msg.role === "assistant") {
    // Markdown 渲染
    const rawHtml = marked.parse(msg.content || "…") as string;
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    div.innerHTML = cleanHtml;
  } else {
    div.textContent = msg.content;
  }

  return div;
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

// ===== 发送消息 =====
async function sendMessage(): Promise<void> {
  const input = document.getElementById("message-input") as HTMLTextAreaElement;
  const content = input.value.trim();
  if (!content || state.streaming) return;

  // 确保有会话
  if (!state.currentConversationId) {
    await createNewConversation();
    if (!state.currentConversationId) return;
  }

  // 清空输入
  input.value = "";
  input.style.height = "auto";
  document.getElementById("send-btn")!.setAttribute("disabled", "");

  // 乐观渲染 user 消息
  const userMsg: Message = {
    id: "temp-" + Date.now(),
    conversationId: state.currentConversationId,
    role: "user",
    content,
    createdAt: Date.now(),
    status: "ok",
    errorCode: null,
  };
  state.messages.push(userMsg);
  renderMessages();

  // 切换到停止按钮
  setStreamingUI(true);

  // 调用后端
  try {
    await api.sendChatMessage({
      conversationId: state.currentConversationId,
      content,
    });
  } catch (e) {
    // 错误由 chat-stream error 事件处理
    console.error("send chat error:", e);
  }
}

function setStreamingUI(streaming: boolean): void {
  state.streaming = streaming;
  const sendBtn = document.getElementById("send-btn")!;
  const input = document.getElementById("message-input") as HTMLTextAreaElement;

  if (streaming) {
    sendBtn.textContent = "停止";
    sendBtn.classList.remove("send-btn");
    sendBtn.classList.add("stop-btn");
    (sendBtn as HTMLButtonElement).disabled = false;
    sendBtn.onclick = () => api.stopChatGeneration();
  } else {
    sendBtn.textContent = "发送";
    sendBtn.classList.remove("stop-btn");
    sendBtn.classList.add("send-btn");
    (sendBtn as HTMLButtonElement).disabled = input.value.trim().length === 0;
    sendBtn.onclick = sendMessage;
  }
}

// ===== 流式事件处理 =====
function handleStreamEvent(event: ChatStreamEvent): void {
  // 只处理当前会话的事件
  if (event.conversationId !== state.currentConversationId && event.type !== "start") {
    // 其他会话的事件，刷新会话列表
    refreshConversations();
    return;
  }

  switch (event.type) {
    case "start":
      state.streaming = true;
      state.streamingContent = "";
      state.streamingConvId = event.conversationId;
      renderMessages();
      break;

    case "delta":
      state.streamingContent += event.delta;
      renderMessages();
      break;

    case "done":
      state.streaming = false;
      state.streamingContent = "";
      state.streamingConvId = null;
      // 重新加载消息
      if (state.currentConversationId) {
        api.getConversationMessages(state.currentConversationId).then((msgs) => {
          state.messages = msgs;
          renderMessages();
        });
      }
      refreshConversations();
      setStreamingUI(false);
      break;

    case "error":
      state.streaming = false;
      state.streamingContent = "";
      state.streamingConvId = null;
      // 添加错误消息
      const errMsg: Message = {
        id: "err-" + Date.now(),
        conversationId: event.conversationId,
        role: "assistant",
        content: event.message,
        createdAt: Date.now(),
        status: "error",
        errorCode: event.code,
      };
      state.messages.push(errMsg);
      renderMessages();
      setStreamingUI(false);
      break;
  }
}

// ===== 角色设定视图 =====
function buildPersonaView(): void {
  const view = document.getElementById("view-persona")!;
  view.innerHTML = `
    <h2>角色设定</h2>
    <div class="subtitle">自定义胡桃对你的称呼和互动方式</div>

    <div class="persona-section">
      <h3>核心身份（只读）</h3>
      <div class="readonly-box" id="core-identity"></div>
    </div>

    <div class="persona-section">
      <h3>说话风格（只读）</h3>
      <div class="readonly-box" id="speech-style"></div>
    </div>

    <div class="persona-section">
      <h3>个性化设置</h3>
      <div class="form-group">
        <label>称呼你为</label>
        <input type="text" id="f-userCallName" maxlength="32" placeholder="旅行者" />
      </div>
      <div class="form-group">
        <label>你们的关系</label>
        <input type="text" id="f-relationship" maxlength="64" placeholder="老朋友" />
      </div>
      <div class="form-group">
        <label>性格偏向</label>
        <select id="f-personalityBias">
          <option value="caring">体贴温柔</option>
          <option value="mischievous">古灵精怪</option>
          <option value="shy">害羞内敛</option>
          <option value="confident">自信开朗</option>
          <option value="sleepy">软软困困</option>
        </select>
      </div>
      <div class="form-group">
        <label>语气偏好</label>
        <select id="f-tonePreference">
          <option value="gentle">温柔</option>
          <option value="energetic">元气</option>
          <option value="tsundere">傲娇</option>
          <option value="soft">软糯</option>
          <option value="playful">俏皮</option>
        </select>
      </div>
      <div class="form-group">
        <label>额外备注</label>
        <textarea id="f-extraNotes" maxlength="500" placeholder="其他你想让胡桃知道的事..."></textarea>
      </div>
      <button class="save-btn" id="save-persona-btn">保存设置</button>
    </div>
  `;

  document.getElementById("save-persona-btn")!.addEventListener("click", savePersona);
}

async function loadPersona(): Promise<void> {
  try {
    state.persona = await api.getPersonaProfile();
    renderPersonaForm();
  } catch (e) {
    console.error("加载人设失败:", e);
  }
}

function renderPersonaForm(): void {
  if (!state.persona) return;
  const p = state.persona;

  // 只读区域（硬编码人设）
  document.getElementById("core-identity")!.textContent =
    "你是胡桃，璃月往生堂第七十七任堂主。你自称「本堂主」，性格古灵精怪、爱开玩笑，常把生死挂在嘴边却并不让人害怕。你最讨厌别人把往生堂和「晦气」联系在一起，会认真纠正。你和旅行者（用户）关系很好，喜欢突然出现在他身边。";
  document.getElementById("speech-style")!.textContent =
    "语气俏皮跳脱，自称「本堂主」或「胡桃」，称呼用户为「旅行者」。常用「哎嘿」「嘿嘿」「哎呀呀」等语气词。喜欢用顺口溜打趣。偶尔用 *叉着腰* / *凑近了看* 这样的动作描写。";

  // 表单
  (document.getElementById("f-userCallName") as HTMLInputElement).value = p.userCallName;
  (document.getElementById("f-relationship") as HTMLInputElement).value = p.relationship;
  (document.getElementById("f-personalityBias") as HTMLSelectElement).value = p.personalityBias;
  (document.getElementById("f-tonePreference") as HTMLSelectElement).value = p.tonePreference;
  (document.getElementById("f-extraNotes") as HTMLTextAreaElement).value = p.extraNotes;
}

async function savePersona(): Promise<void> {
  const btn = document.getElementById("save-persona-btn") as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = "保存中...";

  const fields: PersonaProfileFields = {
    userCallName: (document.getElementById("f-userCallName") as HTMLInputElement).value,
    relationship: (document.getElementById("f-relationship") as HTMLInputElement).value,
    personalityBias: (document.getElementById("f-personalityBias") as HTMLSelectElement).value,
    tonePreference: (document.getElementById("f-tonePreference") as HTMLSelectElement).value,
    extraNotes: (document.getElementById("f-extraNotes") as HTMLTextAreaElement).value,
  };

  try {
    state.persona = await api.updatePersonaProfile(fields);
    renderPersonaForm();
    btn.textContent = "已保存 ✓";
    setTimeout(() => {
      btn.textContent = "保存设置";
      btn.disabled = false;
    }, 1500);
  } catch (e) {
    btn.textContent = "保存失败";
    console.error(e);
    setTimeout(() => {
      btn.textContent = "保存设置";
      btn.disabled = false;
    }, 1500);
  }
}

// ===== API 设置视图 =====
function buildSettingsView(): void {
  const view = document.getElementById("view-settings")!;
  view.innerHTML = `
    <h2>API 设置</h2>
    <div class="subtitle">配置 DeepSeek API Key（加密存储于系统 Keychain）</div>

    <div class="status-box">
      <span class="status-label">当前状态：</span>
      <span class="status-value" id="api-status">加载中...</span>
    </div>

    <div class="form-group">
      <label>API Key</label>
      <input type="password" id="api-key-input" placeholder="sk-..." />
    </div>

    <div class="api-actions">
      <button class="btn-primary" id="save-key-btn">保存</button>
      <button class="btn-danger" id="delete-key-btn">删除</button>
      <button class="btn-secondary" id="test-key-btn">测试连接</button>
    </div>

    <div id="test-result"></div>
  `;

  document.getElementById("save-key-btn")!.addEventListener("click", saveApiKey);
  document.getElementById("delete-key-btn")!.addEventListener("click", deleteApiKey);
  document.getElementById("test-key-btn")!.addEventListener("click", testApiKey);
}

async function loadApiKeyStatus(): Promise<void> {
  try {
    state.apiKeyStatus = await api.getApiKeyStatus();
    renderApiKeyStatus();
  } catch (e) {
    console.error("加载 API Key 状态失败:", e);
  }
}

function renderApiKeyStatus(): void {
  const el = document.getElementById("api-status")!;
  if (!state.apiKeyStatus) {
    el.textContent = "加载中...";
    return;
  }
  if (state.apiKeyStatus.configured) {
    el.textContent = state.apiKeyStatus.masked;
    el.className = "status-value configured";
  } else {
    el.textContent = "未配置";
    el.className = "status-value not-configured";
  }
}

async function saveApiKey(): Promise<void> {
  const input = document.getElementById("api-key-input") as HTMLInputElement;
  const key = input.value.trim();
  if (!key) return;

  const btn = document.getElementById("save-key-btn") as HTMLButtonElement;
  btn.disabled = true;
  try {
    await api.setApiKey(key);
    input.value = "";
    await loadApiKeyStatus();
    btn.textContent = "已保存 ✓";
    setTimeout(() => {
      btn.textContent = "保存";
      btn.disabled = false;
    }, 1500);
  } catch (e) {
    console.error(e);
    btn.textContent = "保存失败";
    setTimeout(() => {
      btn.textContent = "保存";
      btn.disabled = false;
    }, 1500);
  }
}

async function deleteApiKey(): Promise<void> {
  const btn = document.getElementById("delete-key-btn") as HTMLButtonElement;
  btn.disabled = true;
  try {
    await api.clearApiKey();
    await loadApiKeyStatus();
    btn.textContent = "已删除 ✓";
    setTimeout(() => {
      btn.textContent = "删除";
      btn.disabled = false;
    }, 1500);
  } catch (e) {
    console.error(e);
    btn.textContent = "删除失败";
    setTimeout(() => {
      btn.textContent = "删除";
      btn.disabled = false;
    }, 1500);
  }
}

async function testApiKey(): Promise<void> {
  const btn = document.getElementById("test-key-btn") as HTMLButtonElement;
  const resultDiv = document.getElementById("test-result")!;
  btn.disabled = true;
  btn.textContent = "测试中...";
  resultDiv.innerHTML = "";

  // 如果输入框有值，测试输入的 key；否则测试已保存的
  const input = document.getElementById("api-key-input") as HTMLInputElement;
  const key = input.value.trim() || undefined;

  try {
    const [ok, msg] = await api.testApiKey(key);
    resultDiv.className = "test-result " + (ok ? "ok" : "fail");
    resultDiv.textContent = msg;
  } catch (e) {
    resultDiv.className = "test-result fail";
    resultDiv.textContent = "测试失败: " + (e as Error).message;
  } finally {
    btn.textContent = "测试连接";
    btn.disabled = false;
  }
}

// ===== 启动 =====
async function bootstrap(): Promise<void> {
  buildLayout();
  buildChatView();
  buildPersonaView();
  buildSettingsView();

  // 先注册事件监听，确保不丢失事件
  await api.onChatOpenOptions((options) => {
    if (options.view) {
      switchView(options.view);
    }
  });
  await api.onChatStream(handleStreamEvent);

  // 然后加载数据
  await Promise.all([refreshConversations(), loadPersona(), loadApiKeyStatus()]);
}

void bootstrap();
