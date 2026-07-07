(() => {
  const root = document.querySelector("[data-chat-widget]");

  if (!root) return;

  const config = readChatConfig();

  if (!config.enabled) {
    root.hidden = true;
    return;
  }

  const launcher = root.querySelector("[data-chat-toggle]");
  const panel = root.querySelector("[data-chat-panel]");
  const closeButton = root.querySelector("[data-chat-close]");
  const statusNode = root.querySelector("[data-chat-status]");
  const messagesNode = root.querySelector("[data-chat-messages]");
  const unreadNode = root.querySelector("[data-chat-unread]");
  const form = root.querySelector("[data-chat-form]");
  const input = root.querySelector("[data-chat-input]");
  const submitButton = root.querySelector("[data-chat-submit]");
  let isOpen = false;
  let latestId = 0;
  let loaded = false;
  let polling = false;
  let pollTimer = 0;
  let unreadCount = 0;

  bindChat();
  setChatStatus(config.ready ? "Loading chat..." : (config.message || "Chat is offline right now."), config.ready ? "loading" : "error");
  pollHistory(false);

  function readChatConfig() {
    const defaults = {
      enabled: true,
      ready: false,
      message: "",
      endpointUrl: "",
      csrfToken: "",
      historyLimit: 100,
      pollOpenMs: 3000,
      pollClosedMs: 15000,
      messageMaxLength: 500,
      signedIn: false,
      linkUrl: "./link/"
    };
    const node = document.getElementById("site-config");

    if (!node) return defaults;

    try {
      const parsed = JSON.parse(node.textContent || "{}");
      return {
        ...defaults,
        ...(parsed.chat || {})
      };
    } catch (error) {
      return defaults;
    }
  }

  function bindChat() {
    if (launcher) {
      launcher.addEventListener("click", () => {
        setOpen(!isOpen);
      });
    }

    if (closeButton) {
      closeButton.addEventListener("click", () => setOpen(false));
    }

    if (form) {
      form.addEventListener("submit", event => {
        event.preventDefault();
        submitMessage();
      });
    }

    document.addEventListener("visibilitychange", () => {
      window.clearTimeout(pollTimer);

      if (document.visibilityState === "visible") {
        pollHistory(true);
      }
    });
  }

  function setOpen(nextOpen) {
    isOpen = Boolean(nextOpen);
    root.dataset.chatOpen = isOpen ? "true" : "false";

    if (panel) {
      panel.hidden = !isOpen;
    }

    if (launcher) {
      launcher.setAttribute("aria-expanded", String(isOpen));
    }

    if (isOpen) {
      unreadCount = 0;
      updateUnread();
      pollHistory(true);

      if (input) {
        window.setTimeout(() => input.focus(), 40);
      }
    } else {
      schedulePoll();
    }
  }

  async function pollHistory(incremental) {
    if (polling || document.visibilityState === "hidden") {
      schedulePoll();
      return;
    }

    if (!config.endpointUrl || !window.fetch || !config.ready) {
      setChatStatus(config.message || "Chat is offline right now.", "error");
      schedulePoll();
      return;
    }

    polling = true;
    window.clearTimeout(pollTimer);

    try {
      const url = new URL(config.endpointUrl, window.location.href);

      if (incremental && latestId > 0) {
        url.searchParams.set("after_id", String(latestId));
      }

      const response = await fetch(url.toString(), {
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = await readJson(response);

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || payload.message || `Chat refresh failed with HTTP ${response.status}.`);
      }

      if (!payload.ready) {
        setChatStatus(payload.message || "Chat is being set up.", "error");
        return;
      }

      const messages = Array.isArray(payload.messages) ? payload.messages : [];

      if (!incremental || latestId <= 0) {
        renderMessages(messages);
      } else {
        appendMessages(messages, true);
      }

      setChatStatus(config.signedIn ? "Connected as Steam-linked." : "Read-only. Link Steam to post.", "ready");
      loaded = true;
    } catch (error) {
      setChatStatus(error.message || "Chat could not be refreshed.", "error");
    } finally {
      polling = false;
      schedulePoll();
    }
  }

  async function submitMessage() {
    if (!form || !input || !config.signedIn) return;

    const message = input.value.trim();

    if (!message) {
      setChatStatus("Type a message before sending.", "error");
      return;
    }

    setFormLocked(true);

    try {
      const response = await fetch(config.endpointUrl, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Requested-With": "fetch",
          "X-Raidlands-CSRF": config.csrfToken || ""
        },
        body: JSON.stringify({
          action: "message",
          csrf: config.csrfToken || "",
          message
        })
      });
      const payload = await readJson(response);

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `Chat message failed with HTTP ${response.status}.`);
      }

      input.value = "";

      if (payload.message) {
        appendMessages([payload.message], false);
      }

      setChatStatus("Message sent.", "ready");
      pollHistory(true);
    } catch (error) {
      setChatStatus(error.message || "Chat message could not be sent.", "error");
    } finally {
      setFormLocked(false);
    }
  }

  function renderMessages(messages) {
    if (!messagesNode) return;

    messagesNode.replaceChildren();
    latestId = 0;
    appendMessages(messages, false);

    if (messages.length === 0) {
      const empty = document.createElement("div");
      empty.className = "chat-empty";
      empty.textContent = "No messages yet. The lobby is quiet.";
      messagesNode.appendChild(empty);
    }
  }

  function appendMessages(messages, countUnread) {
    if (!messagesNode || !Array.isArray(messages) || messages.length === 0) return;

    const hadEmpty = messagesNode.querySelector(".chat-empty");

    if (hadEmpty) {
      hadEmpty.remove();
    }

    let appended = 0;

    messages.forEach(message => {
      const id = Number(message.id) || 0;

      if (id <= 0 || messagesNode.querySelector(`[data-chat-message-id="${id}"]`)) {
        return;
      }

      messagesNode.appendChild(renderMessage(message));
      latestId = Math.max(latestId, id);
      appended += 1;
    });

    trimMessageDom();

    if (appended > 0) {
      if (!isOpen && loaded && countUnread) {
        unreadCount += appended;
        updateUnread();
      }

      if (isOpen) {
        messagesNode.scrollTop = messagesNode.scrollHeight;
      }
    }
  }

  function renderMessage(message) {
    const item = document.createElement("article");
    item.className = "chat-message";
    item.dataset.chatMessageId = String(message.id || "");

    if (message.isStaff) {
      item.classList.add("is-staff");
    }

    const avatar = document.createElement("span");
    avatar.className = "chat-avatar";

    if (message.avatarUrl) {
      const image = document.createElement("img");
      image.src = message.avatarUrl;
      image.alt = "";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      avatar.appendChild(image);
    } else {
      avatar.textContent = initials(message.displayName || "RL");
    }

    const body = document.createElement("div");
    body.className = "chat-message-body";
    const meta = document.createElement("div");
    meta.className = "chat-message-meta";
    const name = message.profileUrl ? document.createElement("a") : document.createElement("strong");

    name.textContent = message.displayName || "Raidlands Player";

    if (message.profileUrl) {
      name.href = message.profileUrl;
      name.target = "_blank";
      name.rel = "noopener noreferrer";
    }

    meta.appendChild(name);

    if (message.isStaff) {
      const badge = document.createElement("span");
      badge.className = "chat-staff-badge";
      badge.textContent = "Staff";
      meta.appendChild(badge);
    }

    const time = document.createElement("time");
    time.dateTime = message.createdAt || "";
    time.textContent = formatTime(message.createdAt || "");
    meta.appendChild(time);

    const copy = document.createElement("p");
    copy.textContent = message.message || "";

    body.append(meta, copy);
    item.append(avatar, body);

    return item;
  }

  function trimMessageDom() {
    if (!messagesNode) return;

    const max = Math.max(20, Number(config.historyLimit) || 100);
    const rows = Array.from(messagesNode.querySelectorAll("[data-chat-message-id]"));

    rows.slice(0, Math.max(0, rows.length - max)).forEach(row => row.remove());
  }

  function updateUnread() {
    if (!unreadNode) return;

    unreadNode.hidden = unreadCount <= 0;
    unreadNode.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
  }

  function schedulePoll() {
    window.clearTimeout(pollTimer);

    if (document.visibilityState === "hidden") {
      return;
    }

    const delay = isOpen
      ? Math.max(1000, Number(config.pollOpenMs) || 3000)
      : Math.max(5000, Number(config.pollClosedMs) || 15000);
    pollTimer = window.setTimeout(() => pollHistory(true), delay);
  }

  function setChatStatus(message, state) {
    if (!statusNode) return;

    statusNode.textContent = message;
    statusNode.dataset.chatStatus = state || "ready";
  }

  function setFormLocked(locked) {
    if (input) input.disabled = locked;
    if (submitButton) {
      submitButton.disabled = locked;
      submitButton.textContent = locked ? "Sending..." : "Send";
    }
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch (error) {
      return {
        ok: false,
        error: "The server returned an unreadable chat response."
      };
    }
  }

  function initials(name) {
    return String(name || "RL")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0] || "")
      .join("")
      .toUpperCase() || "RL";
  }

  function formatTime(value) {
    const date = new Date(value.replace(" ", "T"));

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
})();
