// SOCLE AXION — assemble une vignette : visuel du générateur + calques communs.
// Adresse : page.html?g=<id>&r=169|916[&insta=1][&reperes=1]
window.GENERATEURS = window.GENERATEURS || {};
const RACINE = "../../../../"; // racine du dépôt depuis docs/vignettes/maquettes/gabarit/

// Pictogrammes des étiquettes (trait 24×24, orange)
window.PICTOS = {
  balance: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  camera: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3"/>',
  cartes: '<rect x="3" y="4" width="12" height="9" rx="1.5"/><rect x="9" y="11" width="12" height="9" rx="1.5"/>',
  craie: '<path d="M3 17c3-6 5 2 8-4s5 3 8-3"/><path d="M4 21h16"/>',
  rouages: '<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M7.5 12h4l5-5M11.5 12l5 5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  micro: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>',
  eclair: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  ecran: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M12 4v16"/>',
  courbe: '<path d="M3 20V4M3 20h18"/><path d="M6 16l4-5 3 3 6-8"/>',
  bulle: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8"/>',
  main: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><circle cx="12" cy="18" r="1"/>',
};

// Photo d'appui (images déjà présentes dans le dépôt)
window.photo = (chemin, style = "") =>
  `<div class="photo" style="background-image:url('${RACINE}${chemin}');${style}"></div>`;

// Doublure de visage : silhouette tête-épaules en contre-jour chaud.
// Sur une vraie vidéo, c'est l'image de Will extraite de la vidéo, détourée.
window.portrait = ({ x = 0, y = 0, h = 100, regard = 0, unite = "%", style = "" } = {}) => `
  <svg class="portrait" viewBox="0 0 400 480" preserveAspectRatio="xMidYMax meet"
       style="position:absolute;left:${x}${unite};bottom:${y}${unite};height:${h}${unite};${style}">
    <defs>
      <radialGradient id="peau${regard}" cx="${38 + regard * 8}%" cy="38%" r="70%">
        <stop offset="0" stop-color="#4a2e20"/><stop offset=".5" stop-color="#24150d"/><stop offset="1" stop-color="#0e0805"/>
      </radialGradient>
      <linearGradient id="veste${regard}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#3a2a22"/><stop offset=".5" stop-color="#1a120d"/><stop offset="1" stop-color="#0d0805"/>
      </linearGradient>
      <linearGradient id="bord${regard}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#f4b07c" stop-opacity="1"/><stop offset=".28" stop-color="#e08048" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="bord2${regard}" x1="1" y1="0" x2="0" y2="0">
        <stop offset="0" stop-color="#E9DCC8" stop-opacity=".7"/><stop offset=".22" stop-color="#E9DCC8" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="halo${regard}" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#c8906a" stop-opacity=".8"/><stop offset=".6" stop-color="#8a5636" stop-opacity=".3"/><stop offset="1" stop-color="#3a2014" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <ellipse cx="200" cy="190" rx="190" ry="170" fill="url(#halo${regard})"/>
    <path d="M30 480 C40 380 90 340 150 325 L170 300 L230 300 L250 325 C310 340 360 380 372 480 Z" fill="url(#veste${regard})"/>
    <path d="M168 300 L200 372 L232 300 Z" fill="#8a7a66" opacity=".55"/>
    <path d="M200 372 L188 330 L200 318 L212 330 Z" fill="#7a2e16"/>
    <path d="M170 250 L170 305 Q200 322 230 305 L230 250 Z" fill="#3b2418"/>
    <ellipse cx="200" cy="178" rx="78" ry="98" fill="url(#peau${regard})"/>
    <path d="M122 160 Q124 70 200 68 Q280 70 280 160 Q268 112 200 108 Q136 110 122 160Z" fill="#140c08"/>
    <ellipse cx="200" cy="178" rx="78" ry="98" fill="none" stroke="url(#bord${regard})" stroke-width="7"/>
    <ellipse cx="200" cy="178" rx="78" ry="98" fill="none" stroke="url(#bord2${regard})" stroke-width="4"/>
    <path d="M30 480 C40 380 90 340 150 325" fill="none" stroke="url(#bord${regard})" stroke-width="6"/>
    <path d="M372 480 C360 380 310 340 250 325" fill="none" stroke="url(#bord2${regard})" stroke-width="4"/>
  </svg>`;

function titreHTML(lignes) {
  return lignes.map(l => `<span class="ligne">${l.replace(/\*([^*]+)\*/g, (_, m, i) => `<span class="mot-orange${i === 0 ? " debut" : ""}">${m}</span>`)}</span>`).join("");
}

window.addEventListener("DOMContentLoaded", () => {
  const q = new URLSearchParams(location.search);
  const g = window.GENERATEURS[q.get("g")];
  const r = q.get("r") === "916" ? "916" : "169";
  const insta = q.get("insta") === "1";
  if (!g) { document.body.textContent = "générateur inconnu : " + q.get("g"); return; }
  const ctx = { r, insta, v: r === "916" };
  const titre = (g.titreParRatio && g.titreParRatio[r]) || g.titre;
  const el = document.createElement("div");
  el.className = `vignette r${r} g-${g.id}${insta ? " insta" : ""}`;
  el.innerHTML = `
    <div class="visuel">${g.visuel(ctx)}</div>
    <div class="lumiere"></div>
    <div class="degrade"></div>
    <div class="grain"></div>
    ${g.dessus ? g.dessus(ctx) : ""}
    <div class="lisere"></div>
    <div class="coin"><div class="mono">A</div>
      <div class="etiquette"><svg viewBox="0 0 24 24">${window.PICTOS[g.picto]}</svg>${g.etiquette}</div></div>
    <h1 class="titre">${titreHTML(titre)}</h1>
    <div class="signature">axion-ia.com</div>`;
  if (q.get("reperes") === "1" && r === "916") {
    el.classList.add("reperes");
    el.insertAdjacentHTML("beforeend",
      `<div class="zone" style="left:0;right:0;top:240px;height:1440px"><span>grille 3:4</span></div>
       <div class="zone" style="left:0;right:0;top:420px;height:1080px;border-color:#ffd23f"><span style="color:#ffd23f">grille 1:1</span></div>
       <div class="zone" style="left:0;right:0;bottom:0;height:480px;border-color:#ff5a5a"><span style="color:#ff5a5a">interface (bas)</span></div>`);
  }
  if (q.get("reperes") === "1" && r === "169") {
    el.classList.add("reperes");
    el.insertAdjacentHTML("beforeend", `<div class="zone" style="right:8px;bottom:8px;width:120px;height:46px;border-color:#ff5a5a"><span style="color:#ff5a5a">durée</span></div>`);
  }
  document.body.appendChild(el);
  if (g.style) { const s = document.createElement("style"); s.textContent = g.style; document.head.appendChild(s); }
  // Le titre garde la taille de la série ; au plus -15 % s'il est trop large.
  // Au-delà, c'est le texte qu'il faut raccourcir (signalé par data-trop-long).
  document.fonts.ready.then(() => {
    const t = el.querySelector(".titre");
    const max = r === "916" ? 856 : 640;
    const large = Math.max(...[...t.querySelectorAll(".ligne")].map(l => l.scrollWidth));
    document.body.dataset.largeurTitre = large;
    if (large > max) {
      const f = Math.max(0.85, max / large);
      t.style.fontSize = (parseFloat(getComputedStyle(t).fontSize) * f).toFixed(1) + "px";
      if (max / large < 0.85) document.body.dataset.tropLong = "1";
    }
    document.body.dataset.pret = "1";
  });
});
