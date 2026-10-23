// Variantes SANS VISAGE — écrites dans le socle (même contrat que variantes-reference.js).
// Chaque générateur ne fournit que : étiquette + picto, titre, et le calque « visuel » (+ son CSS préfixé).
// Un élément distinctif fort par générateur, lisible à 160 px de large :
//   TB tableau-anime : panneau crème incliné couvert de dessin au trait
//   IV image-video   : infographie qui se décolle en couches éclatées 3D
//   MO motion        : chiffre géant « 3 » en contour + histogramme et arcs

// TB — Tableau animé : le texte s'écrit et se dessine à la main sur un panneau crème
window.GENERATEURS["tableau-anime"] = {
  id: "tableau-anime", code: "TB", etiquette: "Tableau animé", picto: "craie",
  titre: ["L'erreur", "*coûte* cher"],
  visuel: () => `
    <div class="tb-lueur"></div>
    <div class="tb-panneau">
      <i class="tb-ruban tb-r1"></i><i class="tb-ruban tb-r2"></i>
      <svg class="tb-dessin" viewBox="0 0 600 440" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <!-- écriture manuscrite (ligne de titre + 2 lignes) -->
        <path d="M44 84c14-44 24-44 30-6s14 40 26 2 18-30 26 2 14 34 28-4 16-30 26 0 16 30 30-6 14-28 24-2 18 30 32-2" stroke="#110A05" stroke-width="11"/>
        <path d="M44 150c12-26 22-26 28-2s12 26 24 0 16-22 24 0 12 24 26-2 14-20 24 0 14 22 26 0" stroke="#110A05" stroke-width="8" opacity=".82"/>
        <!-- mot entouré à l'orange -->
        <path d="M60 238c-4-34 60-52 150-50 96 2 142 22 138 56-4 38-90 56-182 52-80-3-110-20-108-52 2-26 50-44 120-48" stroke="#B44F29" stroke-width="9"/>
        <path d="M92 242c10-22 20-22 26 0s14 24 26-2 14-22 24 0 12 22 26-2 14-20 26 2" stroke="#110A05" stroke-width="11"/>
        <!-- croix de l'erreur -->
        <path d="M410 70l96 96M506 62l-92 100" stroke="#110A05" stroke-width="15"/>
        <!-- flèche tracée vers le bas -->
        <path d="M372 238c46 14 74 44 62 98" stroke="#110A05" stroke-width="9"/>
        <path d="M404 316l30 28 28-34" stroke="#110A05" stroke-width="9"/>
        <!-- double souligné orange -->
        <path d="M60 372c80-14 180-14 290-2M78 400c76-10 160-8 244 0" stroke="#110A05" stroke-width="8" opacity=".6"/>
        <!-- étincelles -->
        <path d="M330 130l12-22M350 142l22-14M300 112l2-24" stroke="#110A05" stroke-width="6" opacity=".6"/>
      </svg>
      <div class="tb-feutre"><b></b><u></u><s></s></div>
    </div>`,
  style: `
    .g-tableau-anime .tb-lueur { position:absolute; inset:0;
      background: radial-gradient(45% 55% at 72% 42%, rgba(224,112,64,.16), transparent 70%); }
    .g-tableau-anime .tb-panneau { position:absolute; border-radius:14px;
      background:
        radial-gradient(120% 90% at 20% 0%, rgba(255,255,255,.35), transparent 55%),
        repeating-linear-gradient(0deg, rgba(17,10,5,.035) 0 2px, transparent 2px 7px),
        linear-gradient(165deg, #efe3cf, #E9DCC8 55%, #d6c6aa);
      border:1.5px solid rgba(191,168,139,.9);
      box-shadow: 0 0 0 7px rgba(17,10,5,.55), 0 0 0 9px rgba(191,168,139,.35), 0 50px 90px rgba(0,0,0,.62), 0 14px 26px rgba(0,0,0,.4); }
    .r169.g-tableau-anime .tb-panneau { left:672px; top:58px; width:540px; height:394px; transform:rotate(-4.5deg); }
    .r916.g-tableau-anime .tb-panneau { left:170px; top:585px; width:730px; height:535px; transform:rotate(-3.5deg); }
    .g-tableau-anime .tb-dessin { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
    .g-tableau-anime .tb-ruban { position:absolute; top:-18px; width:120px; height:38px; background:rgba(191,168,139,.9); box-shadow:0 4px 10px rgba(0,0,0,.35); }
    .g-tableau-anime .tb-r1 { left:34px; transform:rotate(-8deg); }
    .g-tableau-anime .tb-r2 { right:34px; transform:rotate(7deg); background:rgba(191,168,139,.75); }
    .g-tableau-anime .tb-feutre { position:absolute; right:-40px; bottom:-34px; width:290px; height:46px; transform:rotate(-28deg); filter:drop-shadow(0 14px 14px rgba(0,0,0,.5)); }
    .r169.g-tableau-anime .tb-feutre { right:-34px; bottom:-26px; width:240px; height:40px; }
    .g-tableau-anime .tb-feutre b { position:absolute; left:46px; right:0; top:0; bottom:0; border-radius:6px 20px 20px 6px;
      background:linear-gradient(#2a1a10, #110A05 60%, #000); border:1.5px solid rgba(233,220,200,.25); }
    .g-tableau-anime .tb-feutre u { position:absolute; left:100px; width:22px; top:-2px; bottom:-2px; background:#BFA88B; }
    .g-tableau-anime .tb-feutre s { position:absolute; left:0; width:54px; top:9px; bottom:9px; background:linear-gradient(90deg,#BFA88B,#E9DCC8);
      clip-path:polygon(0 50%, 100% 0, 100% 100%); }
  `,
};

// IV — Image → vidéo : l'infographie se décolle en couches éclatées, avec traînées de mouvement
window.GENERATEURS["image-video"] = {
  id: "image-video", code: "IV", etiquette: "Image → vidéo", picto: "image",
  titre: ["Une image", "prend *vie*"],
  visuel: () => `
    <div class="iv-lueur"></div>
    <div class="iv-persp"><div class="iv-scene">
      <i class="iv-ombre"></i>
      <i class="iv-pil" style="left:0;top:0"></i><i class="iv-pil" style="left:100%;top:0"></i>
      <i class="iv-pil" style="left:100%;top:100%"></i><i class="iv-pil" style="left:0;top:100%"></i>
      <div class="iv-couche iv-c0"><span class="iv-g"></span></div>
      <div class="iv-couche iv-c1">
        <em style="left:8%;bottom:14%;height:30%"></em><em style="left:30%;bottom:14%;height:52%"></em>
        <em style="left:52%;bottom:14%;height:40%"></em><em class="o" style="left:74%;bottom:14%;height:70%"></em>
      </div>
      <div class="iv-couche iv-c2">
        <svg viewBox="0 0 340 240"><circle cx="110" cy="120" r="66" fill="none" stroke="rgba(233,220,200,.3)" stroke-width="26"/>
          <circle cx="110" cy="120" r="66" fill="none" stroke="#E9DCC8" stroke-width="26" stroke-dasharray="190 415" transform="rotate(-90 110 120)"/>
          <rect x="216" y="56" width="84" height="26" rx="13" fill="rgba(233,220,200,.85)"/>
          <rect x="216" y="104" width="64" height="26" rx="13" fill="rgba(233,220,200,.5)"/>
          <rect x="216" y="152" width="84" height="26" rx="13" fill="rgba(191,168,139,.9)"/></svg>
      </div>
      <i class="iv-fantome" style="transform:translate3d(-40px,-30px,215px)"></i>
      <i class="iv-fantome iv-f2" style="transform:translate3d(-26px,-20px,205px)"></i>
      <div class="iv-couche iv-c3">
        <svg viewBox="0 0 340 240"><rect x="34" y="30" width="150" height="22" rx="11" fill="#110A05"/>
          <rect x="34" y="68" width="100" height="14" rx="7" fill="rgba(17,10,5,.4)"/>
          <path d="M34 214l78-84 52 52 40-34 102 66z" fill="rgba(180,79,41,.42)"/>
          <path d="M34 214l78-84 52 52" fill="none" stroke="rgba(17,10,5,.55)" stroke-width="3"/>
          <circle cx="262" cy="74" r="26" fill="#110A05"/>
          <path d="M254 62l22 12-22 12z" fill="#E9DCC8"/></svg>
      </div>
    </div></div>`,
  style: `
    .g-image-video .iv-lueur { position:absolute; inset:0; background: radial-gradient(40% 50% at 72% 46%, rgba(224,112,64,.17), transparent 72%); }
    .g-image-video .iv-persp { position:absolute; perspective:1500px; width:340px; height:240px; }
    .r169.g-image-video .iv-persp { left:790px; top:215px; transform:scale(1.1); }
    .r916.g-image-video .iv-persp { left:380px; top:775px; transform:scale(1.55); }
    .g-image-video .iv-scene { position:absolute; inset:0; transform-style:preserve-3d; transform: rotateX(56deg) rotateZ(-34deg) translateZ(-70px); }
    .g-image-video .iv-couche, .g-image-video .iv-fantome, .g-image-video .iv-ombre { position:absolute; inset:0; border-radius:16px; }
    .g-image-video .iv-ombre { background:rgba(0,0,0,.75); filter:blur(26px); transform:translateZ(-4px) scale(1.15); }
    .g-image-video .iv-couche { border:2px solid rgba(233,220,200,.55); background:rgba(40,26,17,.68); box-shadow:0 0 0 1px rgba(17,10,5,.6); }
    .g-image-video .iv-c0 { transform:translateZ(0); background:linear-gradient(150deg, rgba(233,220,200,.34), rgba(233,220,200,.12)); }
    .g-image-video .iv-g { position:absolute; inset:0; border-radius:14px;
      background: repeating-linear-gradient(0deg, rgba(233,220,200,.22) 0 1px, transparent 1px 30px), repeating-linear-gradient(90deg, rgba(233,220,200,.22) 0 1px, transparent 1px 30px); }
    .g-image-video .iv-c1 { transform:translate3d(0,0,66px); background:rgba(40,26,17,.55); }
    .g-image-video .iv-c1 em { position:absolute; width:17%; background:linear-gradient(#E9DCC8, #BFA88B); border-radius:4px; box-shadow:10px 10px 0 rgba(0,0,0,.3); }
    .g-image-video .iv-c1 em.o { background:linear-gradient(rgba(224,112,64,.55), rgba(180,79,41,.45)); }
    .g-image-video .iv-c2 { transform:translate3d(-22px,-16px,132px); background:rgba(25,16,10,.55); }
    .g-image-video .iv-c2 svg, .g-image-video .iv-c3 svg { position:absolute; inset:0; width:100%; height:100%; }
    .g-image-video .iv-c3 { transform:translate3d(-56px,-44px,200px); background:linear-gradient(150deg, #f4eadb, #E9DCC8 55%, #BFA88B); border-color:rgba(180,79,41,.45);
      box-shadow:0 0 44px rgba(224,112,64,.25); }
    .g-image-video .iv-fantome { border:2px solid rgba(233,220,200,.5); background:rgba(233,220,200,.08); }
    .g-image-video .iv-f2 { border-color:rgba(233,220,200,.25); background:rgba(233,220,200,.04); }
    .g-image-video .iv-pil { position:absolute; width:0; height:200px; border-left:3px dashed rgba(233,220,200,.6); transform-origin:50% 0; transform:rotateX(90deg); }
  `,
};

// MO — Motion design : « 3 » plein ivoire posé sur un axe, histogramme qui en sort, jauge et grille fine
window.GENERATEURS["motion"] = {
  id: "motion", code: "MO", etiquette: "Motion design", picto: "courbe",
  titre: ["3 chiffres", "sur l'*IA*"],
  visuel: () => `
    <div class="mo-lueur"></div>
    <svg class="mo-svg" viewBox="0 0 600 640" fill="none">
      <defs>
        <linearGradient id="mo-iv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9DCC8"/><stop offset="1" stop-color="#BFA88B"/></linearGradient>
        <linearGradient id="mo-sa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(233,220,200,.5)"/><stop offset="1" stop-color="rgba(191,168,139,.12)"/></linearGradient>
        <linearGradient id="mo-or" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(224,112,64,.6)"/><stop offset="1" stop-color="rgba(180,79,41,.2)"/></linearGradient>
      </defs>
      <!-- grille fine + axes -->
      <path d="M40 120H590M40 220H590M40 320H590M40 420H590" stroke="rgba(233,220,200,.1)" stroke-width="2"/>
      <path d="M40 60V520H590" stroke="rgba(233,220,200,.55)" stroke-width="3"/>
      <path d="M40 520v14M140 520v14M240 520v14M340 520v14M440 520v14M540 520v14M26 120h14M26 220h14M26 320h14M26 420h14" stroke="rgba(233,220,200,.5)" stroke-width="3"/>
      <!-- jauge circulaire derrière -->
      <circle cx="330" cy="300" r="238" stroke="rgba(233,220,200,.1)" stroke-width="34"/>
      <circle cx="330" cy="300" r="238" stroke="rgba(233,220,200,.55)" stroke-width="34" stroke-dasharray="1120 1500" transform="rotate(135 330 300)"/>
      <circle cx="330" cy="300" r="276" stroke="rgba(233,220,200,.35)" stroke-width="3" stroke-dasharray="2 14"/>
      <!-- histogramme qui sort de la base du 3 -->
      <rect x="330" y="430" width="50" height="90" fill="url(#mo-sa)"/>
      <rect x="394" y="370" width="50" height="150" fill="url(#mo-sa)"/>
      <rect x="458" y="310" width="50" height="210" fill="url(#mo-or)"/>
      <rect x="522" y="240" width="50" height="280" fill="url(#mo-iv)"/>
      <path d="M355 405l64-45 64-60 64-85" stroke="#E9DCC8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="547" cy="215" r="11" fill="#110A05" stroke="#E9DCC8" stroke-width="5"/>
      <!-- le 3 plein, posé sur l'axe -->
      <text x="50" y="520" font-family="Montserrat" font-weight="800" font-size="470" fill="#110A05" opacity=".55" transform="translate(10 10)">3</text>
      <text x="50" y="520" font-family="Montserrat" font-weight="800" font-size="470" fill="url(#mo-iv)">3</text>
      <circle cx="90" cy="60" r="8" fill="rgba(180,79,41,.6)"/><circle cx="118" cy="60" r="8" stroke="#E9DCC8" stroke-width="3"/><circle cx="146" cy="60" r="8" stroke="#E9DCC8" stroke-width="3"/>
    </svg>`,
  style: `
    .g-motion .mo-lueur { position:absolute; inset:0; background: radial-gradient(40% 55% at 70% 45%, rgba(224,112,64,.16), transparent 72%); }
    .g-motion .mo-svg { position:absolute; overflow:visible; }
    .r169.g-motion .mo-svg { left:640px; top:14px; width:560px; height:597px; }
    .r916.g-motion .mo-svg { width:600px; height:640px; left:210px; top:540px; transform:scale(1.08); }
  `,
};

// CC — Cas concret (redéfinit celui de variantes-reference.js, chargé avant) :
// flux d'automatisation en isométrique, nœuds en verre dépoli, fil lumineux, dernière étape validée
window.GENERATEURS["cas-concret"] = {
  id: "cas-concret", code: "CC", etiquette: "Cas concret", picto: "rouages",
  titre: ["Le blog qui", "*s'écrit* seul"],
  visuel: () => `
    <div class="cc-lueur"></div>
    <div class="cc-persp"><div class="cc-scene">
      <i class="cc-sol"></i>
      <i class="cc-trame"></i>
      <svg class="cc-fil" viewBox="0 0 600 260" fill="none" stroke-linecap="round">
        <path d="M150 130H225M375 130H450" stroke="rgba(224,112,64,.5)" stroke-width="16" style="filter:blur(7px)"/>
        <path d="M150 130H225M375 130H450" stroke="#E9DCC8" stroke-width="5"/>
        <circle cx="188" cy="130" r="8" fill="#E9DCC8"/><circle cx="412" cy="130" r="8" fill="#E9DCC8"/>
      </svg>
      <div class="cc-noeud cc-n1"><b></b><i></i><i></i><i></i></div>
      <div class="cc-noeud cc-n2"><b></b><i></i><i></i><i></i></div>
      <div class="cc-noeud cc-n3">
        <svg viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="30" stroke="rgba(233,220,200,.9)" stroke-width="5"/>
          <path d="M36 51l10 10 19-22" stroke="#E9DCC8" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <i></i>
      </div>
    </div></div>`,
  style: `
    .g-cas-concret .cc-lueur { position:absolute; inset:0; background: radial-gradient(40% 50% at 72% 46%, rgba(224,112,64,.16), transparent 72%); }
    .g-cas-concret .cc-persp { position:absolute; width:600px; height:260px; perspective:1600px; }
    .r169.g-cas-concret .cc-persp { left:610px; top:190px; transform:scale(1.04); }
    .r916.g-cas-concret .cc-persp { left:210px; top:790px; transform:scale(1.4); transform-origin:50% 50%; }
    .g-cas-concret .cc-scene { position:absolute; inset:0; transform-style:preserve-3d; transform: rotateX(54deg) rotateZ(-30deg); }
    .g-cas-concret .cc-sol { position:absolute; inset:-20px; border-radius:26px; background:rgba(0,0,0,.55); filter:blur(30px); transform:translateZ(-6px); }
    .g-cas-concret .cc-trame { position:absolute; inset:0; border-radius:20px; border:1.5px solid rgba(233,220,200,.28);
      background: linear-gradient(150deg, rgba(233,220,200,.12), rgba(233,220,200,.03)),
        repeating-linear-gradient(0deg, rgba(233,220,200,.1) 0 1px, transparent 1px 32px), repeating-linear-gradient(90deg, rgba(233,220,200,.1) 0 1px, transparent 1px 32px); }
    .g-cas-concret .cc-fil { position:absolute; inset:0; width:100%; height:100%; transform:translateZ(34px); overflow:visible; }
    .g-cas-concret .cc-noeud { position:absolute; top:60px; width:150px; height:150px; border-radius:24px; padding:22px 20px;
      display:flex; flex-direction:column; gap:12px; justify-content:center;
      background: linear-gradient(135deg, rgba(255,255,255,.34) 0%, rgba(233,220,200,.14) 38%, rgba(233,220,200,.07) 100%);
      border:1.5px solid rgba(233,220,200,.55);
      box-shadow: inset 0 1.5px 0 rgba(255,255,255,.5), inset 0 -20px 30px rgba(17,10,5,.25), 0 0 40px rgba(224,112,64,.12);
      transform:translateZ(30px); }
    .g-cas-concret .cc-n1 { left:0; filter:blur(3px); opacity:.9; }
    .g-cas-concret .cc-n2 { left:225px; }
    .g-cas-concret .cc-n3 { left:450px; align-items:center; border-color:rgba(233,220,200,.8); box-shadow: inset 0 1.5px 0 rgba(255,255,255,.6), 0 0 56px rgba(224,112,64,.28); }
    .g-cas-concret .cc-noeud b { width:38px; height:38px; border-radius:50%; background:rgba(233,220,200,.85); box-shadow:0 0 18px rgba(233,220,200,.4); }
    .g-cas-concret .cc-noeud i { display:block; height:9px; border-radius:5px; background:rgba(233,220,200,.5); width:100%; }
    .g-cas-concret .cc-noeud i:nth-of-type(2) { width:72%; }
    .g-cas-concret .cc-noeud i:nth-of-type(3) { width:48%; }
    .g-cas-concret .cc-n3 svg { width:82px; height:82px; }
    .g-cas-concret .cc-n3 i { width:60%; }
  `,
};
