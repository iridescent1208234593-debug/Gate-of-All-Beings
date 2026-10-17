/* global importScripts, workbox */
importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.3/workbox-sw.js')

const {registerRoute} = workbox.routing
const {precacheAndRoute} = workbox.precaching
const {CacheFirst, NetworkFirst, StaleWhileRevalidate} = workbox.strategies

console.log('hello from service worker')
if (workbox) {
	console.log(`Yay! Workbox is loaded 棣冨竴`)
} else {
	console.log(`Boo! Workbox didn't load 棣冩█`)
}

// 新版 service worker 立即接管，避免旧缓存的 index.html / 脚本继续生效。
self.addEventListener('install', () => self.skipWaiting())
workbox.core.clientsClaim()

// Make sure index.html is cached.
precacheAndRoute([{url: './index.html', revision: '167-text-cards'}])

// Cache script resources, i.e. JS files.
registerRoute(({request}) => request.destination === 'script', new NetworkFirst({fetchOptions: {cache: 'no-cache'}}))

// Cache style resources, i.e. CSS files.
registerRoute(
	({request}) => request.destination === 'style',
	// Use cache but update in the background.
	new NetworkFirst({fetchOptions: {cache: 'no-cache'}})
)

// Also cache images.
registerRoute(
	/\.(?:png|gif|jpg|jpeg|webp|svg)$/,
	new CacheFirst({
		cacheName: 'images',
		plugins: [
			new workbox.expiration.ExpirationPlugin({
				maxEntries: 60,
				maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
			}),
		],
	})
)


