import { Chess } from "chess.js";

const apiBaseUrl = (import.meta.env.VITE_CHESS_API_URL || "").replace(/\/$/, "");
const INSTALL_ID_STORAGE_KEY = "chess_install_id";
/** Must match render-backend INSTALL_ID_HEADER / CORS allow-list. */
const INSTALL_ID_HEADER = "X-Chess-Install-Id";

function getInstallId(): string {
  try {
    const existing = localStorage.getItem(INSTALL_ID_STORAGE_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,128}$/.test(existing)) {
      return existing;
    }
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `cm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(INSTALL_ID_STORAGE_KEY, id);
    return id;
  } catch {
    return `cm_ephemeral_${Date.now().toString(36)}`;
  }
}

export async function getChessAdvice(
  fen: string,
  question: string = "What is the best move here and why?",
): Promise<string> {
  if (!apiBaseUrl) {
    return "AI tutor server is not configured. Set VITE_CHESS_API_URL before building the app.";
  }

  try {
    // Validate FEN locally; server also validates with chess.js.
    new Chess(fen);
  } catch {
    return "This board position is invalid, so I cannot analyze it yet.";
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/chess/advice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [INSTALL_ID_HEADER]: getInstallId(),
      },
      body: JSON.stringify({ fen, question }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 503) {
        return (
          data?.error ||
          "Cloud AI tutor is currently off on the server. The sandbox board still works; advice stays disabled until the backend kill switch is enabled."
        );
      }
      if (response.status === 429) {
        return data?.error || "AI tutor usage cap reached for this device. Please try again later.";
      }
      return data?.error || "Sorry, the chess tutor server could not analyze this position.";
    }

    return data?.advice || "I couldn't generate advice for this position.";
  } catch (error) {
    console.error("Chess tutor API error:", error);
    return "Sorry, I could not reach the chess tutor server.";
  }
}
