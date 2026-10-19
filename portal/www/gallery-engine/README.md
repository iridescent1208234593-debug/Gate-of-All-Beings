# Atmospheric Depth Gallery

A Three.js depth-scrolling gallery of the real 罗小黑 artwork collection. Images are discovered from an external directory, their filenames become titles, and ColorThief generates atmosphere palettes through the existing depth/shader interpolation.

Implementation, validation results, tuning and limitations: [Gallery implementation](docs/GALLERY-IMPLEMENTATION.md).

[Article on Codrops](https://tympanus.net/codrops/?p=111409)

[Demo](https://tympanus.net/Tutorials/DepthGallery/)

## Installation

```
npm install
npm run dev
```

For production build:

```
npm run build
npm run preview
```

The default source is `../../../assets/罗小黑战记数据库/罗小黑节气贺图（gallery素材）` relative to this project. Set `GALLERY_DIR` to use another local source.
To use another folder in PowerShell:

```powershell
$env:GALLERY_DIR = 'E:/another/gallery'
npm run dev
```

JPG, JPEG, PNG and WebP are discovered recursively and naturally sorted. The homepage build generates separate WebP previews (maximum dimension 1536, quality 88) under `.releases/.work/gallery-previews` using an `ffmpeg` build with `libwebp`; it never overwrites source images. Public builds and CDN URLs contain previews only. Original files stay in the persistent `asset-library/homepage-gallery` store and are served by `/api/gallery/original` only after the main site's server-side owner check. Image taps/clicks like; double-clicks/double-taps express love. `gallery-interactions.mjs` shares the fan gallery's reaction effects and the same backend action path for image and nearby buttons. The small interaction dock uses the projected image bounds to stay outside its left/right edge, or moves below/above when narrow; per-account like+love interaction count gradually wakes its visuals and unlocks one 25-character comment at 66 confirmed actions. Other comments are shown as up to three hover/tap fragments at a time. When `VITE_ASSET_BASE_URL` is set, preview objects must be uploaded separately before publishing; originals must never be copied to the public CDN.

`npm test` runs discovery, sorting, encoding, palette mapping and alpha regression checks. Press **D** for runtime palette diagnostics; `?inspect` additionally exposes `window.galleryDebug` for console inspection.

## Tech Stack

- Node.js >= 22.12
- [Vite](https://vite.dev/)
- [Three.js](https://threejs.org/)￼
- Vanilla JavaScript (ES Modules)
- GLSL (via vite-plugin-glsl)

## Credits

- Built with [Three.js](https://threejs.org/)
- Gallery imagery: external 罗小黑节气贺图 collection
- Color chip editorial layout inspired by [@thisislandscape](https://www.instagram.com/p/DU2JTU_AEwM/?img_index=3) on Instagram

## Misc

Follow Houmahani Kane: [Portfolio](https://houmahani.com), [X](https://x.com/houma_hani), [Instagram](https://www.instagram.com/houma.hani/), [LinkedIn](https://www.linkedin.com/in/houmahanikane/), [GitHub](https://github.com/houmahani/)

Follow Codrops: [X](http://www.x.com/codrops), [Facebook](https://www.facebook.com/codrops), [Instagram](https://www.instagram.com/codropsss/), [LinkedIn](https://www.linkedin.com/company/codrops/), [GitHub](https://github.com/codrops)

## License

[MIT](LICENSE)
