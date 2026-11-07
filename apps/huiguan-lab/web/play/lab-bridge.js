// Small browser helpers for the Godot web client (loaded as an external script so the page CSP
// needs no 'unsafe-eval'). Nothing here talks to any server except the LAB's own /api/logout.
window.zszmLab = {
  isMobile() {
    return navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches;
  },
  promptText(title, initial) {
    return window.prompt(title, initial || "");
  },
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
    input.accept = accept || "image/png,image/webp";
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
