/* The build replaces the version and asset list with the current app shell. */
const cacheName = 'dll-elite-shell-__BUILD__'
const shell = ['/', '/index.html', '/manifest.webmanifest', '/brand/seal.png', '/brand/campus.png', '/brand/icon-192.png', '/brand/icon-512.png', /* BUILD_ASSETS */]
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shell)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('dll-elite-shell-') && key !== cacheName).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/')) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(cacheName).then(cache => cache.match('/index.html'))))
  } else if (shell.includes(url.pathname)) {
    event.respondWith(caches.open(cacheName).then(async cache => await cache.match(url.pathname) || fetch(request)))
  }
})
