import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface PetConfig {
  alwaysOnTop: boolean;
  windowX: number | null;
  windowY: number | null;
  visible: boolean;
}

export interface OpenChatOptions {
  view?: "chat" | "persona" | "settings";
}

// ===== Chat 数据类型 =====

export interface Conversation {
  id: string;
  petId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  lastMessagePreview: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  status: "ok" | "cancelled" | "error";
  errorCode: string | null;
}

export interface PersonaProfileFields {
  userCallName: string;
  relationship: string;
  personalityBias: string;
  tonePreference: string;
  extraNotes: string;
}

export interface PersonaProfile extends PersonaProfileFields {
  petId: string;
  updatedAt: number;
}

export interface ApiKeyStatus {
  configured: boolean;
  masked: string;
}

export interface SendChatInput {
  conversationId: string;
  content: string;
}

export type ChatStreamEvent =
  | { type: "start"; conversationId: string; userMessageId: string }
  | { type: "delta"; conversationId: string; delta: string }
  | { type: "done"; conversationId: string; assistantMessageId: string; fullContent: string }
  | { type: "error"; conversationId: string; code: string; message: string };

export const api = {
  // ===== 桌宠窗口 =====
  getConfig: (): Promise<PetConfig> => invoke("get_config"),
  moveWindow: (dx: number, dy: number): Promise<void> =>
    invoke("move_window", { dx, dy }),
  savePosition: (): Promise<void> => invoke("save_position"),
  showContextMenu: (): Promise<void> => invoke("show_context_menu"),
  showPet: (): Promise<void> => invoke("show_pet"),
  hidePet: (): Promise<void> => invoke("hide_pet"),
  toggleVisible: (): Promise<void> => invoke("toggle_visible"),
  setAlwaysOnTop: (value: boolean): Promise<void> =>
    invoke("set_always_on_top", { value }),
  openChat: (options?: OpenChatOptions): Promise<void> =>
    invoke("open_chat", { options }),

  // ===== 会话管理 =====
  listConversations: (): Promise<Conversation[]> => invoke("list_conversations"),
  createConversation: (title?: string): Promise<Conversation> =>
    invoke("create_conversation", { title }),
  renameConversation: (conversationId: string, title: string): Promise<void> =>
    invoke("rename_conversation", { conversationId, title }),
  deleteConversation: (conversationId: string): Promise<void> =>
    invoke("delete_conversation", { conversationId }),
  getConversationMessages: (conversationId: string): Promise<Message[]> =>
    invoke("get_conversation_messages", { conversationId }),

  // ===== 人设 =====
  getPersonaProfile: (): Promise<PersonaProfile> => invoke("get_persona_profile"),
  updatePersonaProfile: (fields: PersonaProfileFields): Promise<PersonaProfile> =>
    invoke("update_persona_profile", { fields }),

  // ===== API Key =====
  getApiKeyStatus: (): Promise<ApiKeyStatus> => invoke("get_api_key_status"),
  setApiKey: (apiKey: string): Promise<void> => invoke("set_api_key", { apiKey }),
  clearApiKey: (): Promise<void> => invoke("clear_api_key"),
  testApiKey: (apiKey?: string): Promise<[boolean, string]> =>
    invoke("test_api_key", { apiKey }),

  // ===== 聊天消息 =====
  sendChatMessage: (input: SendChatInput): Promise<void> =>
    invoke("send_chat_message", { input }),
  stopChatGeneration: (): Promise<void> => invoke("stop_chat_generation"),

  // ===== 事件监听 =====
  onConfigChanged: (cb: (config: PetConfig) => void): Promise<UnlistenFn> =>
    listen<PetConfig>("config-changed", (e) => cb(e.payload)),

  onChatOpenOptions: (
    cb: (options: OpenChatOptions) => void
  ): Promise<UnlistenFn> =>
    listen<OpenChatOptions>("chat-open-options", (e) => cb(e.payload)),

  onBusinessState: (
    cb: (state: "busy" | "idle") => void
  ): Promise<UnlistenFn> =>
    listen<{ state: "busy" | "idle" }>("business-state", (e) =>
      cb(e.payload.state)
    ),

  onChatStream: (cb: (event: ChatStreamEvent) => void): Promise<UnlistenFn> =>
    listen<ChatStreamEvent>("chat-stream", (e) => cb(e.payload)),
};
