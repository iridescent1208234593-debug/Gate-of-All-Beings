import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const homepageRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(homepageRoot, "../..");
const galleryRoot = path.join(
  projectRoot,
  "portal/www/gallery-engine",
);
const [{ default: glsl }, { externalGallery }] = await Promise.all([
  import(
    pathToFileURL(
      path.join(galleryRoot, "node_modules/vite-plugin-glsl/src/index.js"),
    )
  ),
  import(pathToFileURL(path.join(galleryRoot, "gallery-plugin.js"))),
]);

const homepageDevRoute = {
  name: "homepage-dev-route",
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (request.url === "/") request.url = "/homepage.html";
      else if (
        request.url === "/assets/homepage/" ||
        request.url === "/assets/homepage"
      ) {
        request.url = "/homepage.html";
      }
      next();
    });
  },
};

export default ({ command }) => ({
  root: homepageRoot,
  base: "/assets/homepage/",
  plugins: [
    glsl(),
    externalGallery(
      process.env.GALLERY_DIR ||
        path.join(
          projectRoot,
          "assets/罗小黑战记数据库/罗小黑节气贺图（gallery素材）",
        ),
    ),
    ...(command === "serve" ? [homepageDevRoute] : []),
  ],
  resolve: {
    alias: [
      {
        find: /^three$/,
        replacement: path.join(galleryRoot, "node_modules/three/build/three.module.js"),
      },
      { find: "@", replacement: path.join(galleryRoot, "src") },
    ],
  },
  build: {
    outDir: path.join(projectRoot, ".releases/.work/homepage"),
    assetsDir: "",
    cssCodeSplit: false,
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(homepageRoot, "homepage.html"),
      output: {
        entryFileNames: "homepage.js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: (asset) =>
          asset.name?.endsWith(".css")
            ? "homepage.css"
            : "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    fs: {
      deny: [
        ".env", ".env.*", "*.{crt,pem}", "**/.git/**",
        "**/罗小黑节气贺图（gallery素材）/**",
        "**/asset-library/homepage-gallery/**",
        "**/gallery-files/**",
      ],
    },
    proxy: {
      "/api/gallery": "http://127.0.0.1:8088",
      "/api/sso-user": "http://127.0.0.1:8088",
    },
  },
});
