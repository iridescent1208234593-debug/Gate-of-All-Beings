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

JPG, JPEG, PNG and WebP are discovered recursively and naturally sorted. Development serves originals directly and reloads on changes. Builds copy them automatically to `dist/gallery-files`; deploy the entire `dist` folder. Originals are never renamed or modified.

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
