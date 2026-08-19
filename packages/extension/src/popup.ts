/// <reference types="chrome" />

type AttachStatus = {
  attached: boolean;
  websocketUrl: string;
  lastFailure: string;
};

const statusEl = document.getElementById("status");
const urlEl = document.getElementById("url");
const failureEl = document.getElementById("failure");
const reconnectEl = document.getElementById("reconnect");

async function render() {
  const status = (await chrome.runtime.sendMessage({
    type: "getAttach",
  })) as AttachStatus;
  if (statusEl) {
    statusEl.textContent = status.attached ? "Attached" : "Not attached";
  }
  if (urlEl) {
    urlEl.textContent = status.websocketUrl;
  }
  if (failureEl) {
    failureEl.textContent = status.attached ? "" : status.lastFailure;
  }
}

reconnectEl?.addEventListener("click", () => {
  if (statusEl) {
    statusEl.textContent = "Not attached";
  }
  void chrome.runtime.sendMessage({ type: "reconnect" });
});

void render();
setInterval(() => void render(), 200);
