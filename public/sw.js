/* Service de cache minimal du Studio : page « hors ligne » quand le réseau manque.
   Aucune donnée privée n'est mise en cache. */
const CACHE = "studio-v1";
const HORS_LIGNE = "/hors-ligne";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([HORS_LIGNE, "/icones/icone.svg"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => caches.match(HORS_LIGNE)));
});

/* Notifications sur le téléphone (lot M1b) : « Votre vidéo est prête », « Une étape n'a pas abouti »… */
self.addEventListener("push", (e) => {
  let d = { titre: "Studio Axion-IA", message: "", lien: "/" };
  try {
    d = { ...d, ...(e.data ? e.data.json() : {}) };
  } catch {
    if (e.data) d.message = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(d.titre, {
      body: d.message,
      icon: "/icones/icone-192.png",
      badge: "/icones/icone-192.png",
      data: { lien: d.lien },
      lang: "fr",
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  // Lot R3 : seulement une page du studio (un lien vers un autre site ouvre l'accueil).
  let lien = new URL("/", self.location.origin).href;
  try {
    const cible = new URL((e.notification.data && e.notification.data.lien) || "/", self.location.origin);
    if (cible.origin === self.location.origin) lien = cible.href;
  } catch {
    /* lien illisible : l'accueil */
  }
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if (f.url.startsWith(self.location.origin) && "focus" in f) {
          f.navigate(lien);
          return f.focus();
        }
      }
      return self.clients.openWindow(lien);
    }),
  );
});
