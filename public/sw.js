self.addEventListener('fetch', event => {
  // Bypass service worker for API requests
  if (event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(fetch(event.request));
});
