export type XY = { x: number; y: number }; // percent from top-left (0–100)

export type CamCfg = {
  enabled: boolean;
  pos: XY;
  widthPct: number;
  borderW: number;
  borderColor: string;
  borderRadius: number;
  ticker: string;
  tickerSize: number;
  tickerColor: string;
  tickerFont: string;
};

export type SupportCfg = {
  pos: XY;
  bgColor: string;
  textColor: string;
  tts: boolean;
  duration: number;
};

export type OverlayCfg = {
  cam: CamCfg;
  support: SupportCfg;
  chatPos: XY;
  chatEnabled: boolean;
};

export const DEFAULT_CAM: CamCfg = {
  enabled: false,
  pos: { x: 1, y: 65 },
  widthPct: 25,
  borderW: 3, borderColor: "#fb923c", borderRadius: 8,
  ticker: "", tickerSize: 13, tickerColor: "#ffffff", tickerFont: "Inter",
};

export const DEFAULT_SUPPORT: SupportCfg = {
  pos: { x: 32, y: 4 },
  bgColor: "#831843", textColor: "#fce7f3", tts: false, duration: 6,
};

export const DEFAULT_CHAT_POS: XY = { x: 68, y: 8 };

const store = new Map<string, OverlayCfg>();

export function getOverlay(streamId: string): OverlayCfg {
  return store.get(streamId) ?? {
    cam: { ...DEFAULT_CAM },
    support: { ...DEFAULT_SUPPORT },
    chatPos: { ...DEFAULT_CHAT_POS },
    chatEnabled: true,
  };
}

export function setOverlay(streamId: string, cfg: OverlayCfg) {
  store.set(streamId, cfg);
}
