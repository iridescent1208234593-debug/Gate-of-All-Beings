// Small browser helpers for the Godot web client (loaded as an external script so the page CSP
// needs no 'unsafe-eval'). Nothing here talks to any server except the LAB's own /api/logout.
window.zszmLab = {
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
  openPublicPage(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password || url.search) return false;
      // The link is activated in the user's button handler; it cannot access the LAB opener.
      const link = document.createElement("a");
      link.href = url.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.append(link);
      link.click();
      link.remove();
      return true;
    } catch {
      return false;
    }
  },
  logout() {
    fetch("/api/logout", { method: "POST", credentials: "same-origin" }).finally(() => location.replace("/"));
  },
  gotoLogin() { location.replace("/"); },
};
