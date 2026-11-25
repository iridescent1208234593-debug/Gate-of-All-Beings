// Small browser helpers for the Godot web client (loaded as an external script so the page CSP
// needs no 'unsafe-eval'). Nothing here talks to any server except the LAB's own /api/logout.
window.zszmLab = {
  isMobile() {
    return navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches;
  },
  promptText(title, initial) {
    return window.prompt(title, initial || "");
  },
  chatRect(x, y, width, height, visible, callback) {
    if (!this.chatForm) {
      const form = document.createElement("form");
      form.id = "lab-mobile-chat";
      form.style.cssText = "position:fixed;z-index:30;display:none;gap:6px;box-sizing:border-box";
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 200;
      input.placeholder = "说点什么…";
      input.setAttribute("aria-label", "聊天消息");
      input.enterKeyHint = "send";
      input.style.cssText = "flex:1;min-width:0;font-size:16px;border:1px solid #a5b49b;border-radius:6px;padding:7px;background:#f5f7ee;color:#26352c";
      const send = document.createElement("button");
      send.type = "submit";
      send.textContent = "发送";
      send.style.cssText = "font-size:16px;padding:6px 12px;border:0;border-radius:6px;background:#dbe9bc;color:#26352c";
      form.append(input, send);
      let composing = false;
      input.addEventListener("compositionstart", () => { composing = true; });
      input.addEventListener("compositionend", () => { composing = false; });
      form.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter" && (composing || e.isComposing || e.keyCode === 229)) e.preventDefault();
      });
      form.addEventListener("keyup", (e) => e.stopPropagation());
      form.addEventListener("pointerdown", (e) => e.stopPropagation());
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (composing || !input.value.trim()) return;
        callback(input.value.trim());
        input.value = "";
        input.blur();
      });
      document.body.append(form);
      this.chatForm = form;
      this.chatInput = input;
    }
    this.chatForm.style.display = visible ? "flex" : "none";
    Object.assign(this.chatForm.style, { left: x + "px", top: y + "px", width: width + "px", height: height + "px" });
    if (!visible && document.activeElement === this.chatInput) this.chatInput.blur();
  },
  chatFocused() { return !!this.chatInput && document.activeElement === this.chatInput; },
  async landscape(callback) {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      if (!screen.orientation || !screen.orientation.lock) {
        callback(false, "此浏览器不支持锁定横屏，请横握手机并开启自动旋转。");
        return;
      }
      await screen.orientation.lock("landscape");
      callback(true, "已切换横屏");
    } catch (error) {
      callback(false, "浏览器未允许锁定横屏，请横握手机并开启自动旋转。");
    }
  },
  pick(accept, callback) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept || "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";
    input.style.display = "none";
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const bytes = new Uint8Array(reader.result);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        callback(file.name, file.type || "", btoa(binary), file.size);
      };
      reader.readAsArrayBuffer(file);
    });
    document.body.appendChild(input);
    input.click();
  },
  logout() {
    fetch("/api/logout", { method: "POST", credentials: "same-origin" }).finally(() => location.replace("/"));
  },
  gotoLogin() { location.replace("/"); },
};
