// Générateurs À VISAGE (7). Même principe que variantes-reference.js :
// chaque générateur ne fournit que id, code, étiquette, picto, titre, visuel(ctx), style.
// Le visage de Will est une doublure (portrait) : emplacement du vrai visage extrait de la vidéo.
// En version Instagram (ctx.insta) : AUCUN visage ni doublure, l'élément distinctif est conservé.

// Helpers locaux (préfixés _) : positionnement absolu et viseur d'objectif
const _b = (s, c = "", cl = "") => `<div class="${cl}" style="position:absolute;${s}">${c}</div>`;
const _viseur = () => `<i class="vz hg"></i><i class="vz hd"></i><i class="vz bg"></i><i class="vz bd"></i>`;
const _etoiles = (n, t) => Array.from({ length: n }, () =>
  `<svg viewBox="0 0 24 24" style="width:${t}px;height:${t}px"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" fill="#BFA88B"/></svg>`).join("");

// FC — Face caméra : très gros plan, visage qui déborde du cadre photo, repères de viseur
window.GENERATEURS["facecam"] = {
  id: "facecam", code: "FC", etiquette: "Face caméra", picto: "camera",
  titre: ["Où fuit", "votre *temps*"],
  visuel: ({ v, insta }) => {
    const cadre = v ? "left:150px;top:580px;width:790px;height:580px" : "left:790px;top:120px;width:440px;height:520px";
    const fond = photo("public/demo/decors/propositions/bureau-soir.jpg",
      `background-position:50% 35%;filter:saturate(.75) brightness(.95) saturate(.9) sepia(.3) blur(${insta ? 0 : 3}px);transform:scale(1.1)`);
    return `
      <div class="fc-halo"></div>
      ${_b(cadre + ";overflow:visible", `
        <div class="fc-photo"></div>
        ${insta ? `<div class="fc-focus"></div>` : `<div class="fc-sortie">${portrait({ x: 50, y: 0, h: v ? 720 : 740, unite: "px", style: "transform:translateX(-50%)" })}</div>`}
        <div class="fc-tiers"></div>
        ${_viseur()}
        <div class="fc-rec"></div>`, "fc-cadre")}`;
  },
  style: `
    .g-facecam .fc-halo { position:absolute; inset:0; background:radial-gradient(40% 55% at 78% 45%, rgba(224,128,72,.25), transparent 70%); }
    .g-facecam .fc-cadre { box-shadow:0 40px 90px rgba(0,0,0,.55); }
    .g-facecam .fc-photo { position:absolute; inset:0; overflow:hidden; background:radial-gradient(70% 70% at 55% 30%, #6b3a22 0%, #351c10 45%, #1a0e08 100%); }
    .g-facecam .fc-photo::after { content:""; position:absolute; inset:0; background:radial-gradient(50% 55% at 50% 28%, rgba(240,160,100,.45), transparent 75%), linear-gradient(to top, rgba(17,10,5,.45), transparent 40%); }
    .g-facecam .fc-sortie { position:absolute; inset:0; clip-path:inset(-400px 0 0 0); }
    .g-facecam .fc-sortie .portrait { left:50% !important; }
    .g-facecam .fc-tiers { position:absolute; inset:0; pointer-events:none;
      background:linear-gradient(90deg,transparent 33.2%,rgba(233,220,200,.14) 33.3%,transparent 33.5%,transparent 66.5%,rgba(233,220,200,.14) 66.6%,transparent 66.8%),
        linear-gradient(0deg,transparent 33.2%,rgba(233,220,200,.14) 33.3%,transparent 33.5%,transparent 66.5%,rgba(233,220,200,.14) 66.6%,transparent 66.8%); }
    .g-facecam .vz { position:absolute; width:46px; height:46px; border:0 solid #E9DCC8; z-index:3; }
    .g-facecam .vz.hg { left:-14px; top:-14px; border-width:3px 0 0 3px; }
    .g-facecam .vz.hd { right:-14px; top:-14px; border-width:3px 3px 0 0; }
    .g-facecam .vz.bg { left:-14px; bottom:-14px; border-width:0 0 3px 3px; }
    .g-facecam .vz.bd { right:-14px; bottom:-14px; border-width:0 3px 3px 0; }
    .r916.g-facecam .vz { width:70px; height:70px; border-width:5px !important; border-style:solid; }
    .r916.g-facecam .vz.hg { border-color:#E9DCC8 transparent transparent #E9DCC8; left:-22px; top:-22px; }
    .r916.g-facecam .vz.hd { border-color:#E9DCC8 #E9DCC8 transparent transparent; right:-22px; top:-22px; }
    .r916.g-facecam .vz.bg { border-color:transparent transparent #E9DCC8 #E9DCC8; left:-22px; bottom:-22px; }
    .r916.g-facecam .vz.bd { border-color:transparent #E9DCC8 #E9DCC8 transparent; right:-22px; bottom:-22px; }
    .g-facecam .fc-rec { position:absolute; right:24px; top:22px; z-index:3; width:14px; height:14px; border-radius:50%; background:#d9501f; opacity:.85; }
    .r916.g-facecam .fc-rec { width:22px; height:22px; right:36px; top:36px; }
    .g-facecam .fc-focus { position:absolute; left:50%; top:50%; width:150px; height:150px; margin:-75px 0 0 -75px; border:3px solid rgba(233,220,200,.85); }
    .r916.g-facecam .fc-focus { width:230px; height:230px; margin:-115px 0 0 -115px; }
    .g-facecam .fc-focus::before, .g-facecam .fc-focus::after { content:""; position:absolute; background:#E9DCC8; left:50%; top:50%; }
    .g-facecam .fc-focus::before { width:34px; height:3px; margin:-1px 0 0 -17px; }
    .g-facecam .fc-focus::after { width:3px; height:34px; margin:-17px 0 0 -1px; }`,
};

// FA — Face caméra animée : 3 cartes « stickers » inclinées (crème/sable, pictos) qui flottent autour du visage
window.GENERATEURS["facecam-animee"] = {
  id: "facecam-animee", code: "FA", etiquette: "Face caméra animée", picto: "cartes",
  titre: ["*3 tâches*", "pour l'IA"],
  visuel: ({ v, insta }) => {
    const fond = photo("public/demo/decors/propositions/bureau-doree.jpg",
      `background-position:50% 30%;filter:saturate(.7) brightness(.6) sepia(.3) blur(${insta ? 1 : 4}px);transform:scale(1.1)`);
    const px = v ? { x: 56, y: 300, h: 820, unite: "px" } : { x: 58, y: 0, h: 98 };
    return `${fond}
      <div class="fa-lueur"></div>
      ${insta ? "" : portrait(px).replace('class="portrait"', 'class="portrait fa-p"')}
      <div class="fa-trait t1"></div><div class="fa-trait t2"></div><div class="fa-trait t3"></div>
      <div class="fa-carte c1"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" fill="none" stroke="#110A05" stroke-width="4"/><path d="M20 11v10l7 4" fill="none" stroke="#110A05" stroke-width="4" stroke-linecap="round"/></svg><i></i><i></i></div>
      <div class="fa-carte c2"><svg viewBox="0 0 40 40"><path d="M8 21l8 8 16-18" fill="none" stroke="#110A05" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg><i></i></div>
      <div class="fa-carte c3"><u></u><u></u><u></u><u></u></div>
      <div class="fa-etincelle"></div>`;
  },
  style: `
    .g-facecam-animee .fa-lueur { position:absolute; inset:0; background:radial-gradient(40% 50% at 70% 40%, rgba(224,128,72,.3), transparent 70%); }
    .r916.g-facecam-animee .fa-p { left:56% !important; bottom:auto !important; top:400px; transform:translateX(-50%); }
    .r169.g-facecam-animee .fa-p { left:58% !important; transform:translateX(-50%); }
    .g-facecam-animee .fa-carte { position:absolute; border-radius:20px; box-shadow:0 26px 50px rgba(0,0,0,.55); z-index:3; display:flex; flex-direction:column; gap:12px; padding:20px; }
    .g-facecam-animee .fa-carte svg { width:56px; height:56px; }
    .g-facecam-animee .fa-carte i, .g-facecam-animee .fa-carte u { display:block; height:10px; border-radius:5px; background:rgba(17,10,5,.28); text-decoration:none; }
    .g-facecam-animee .fa-carte i:last-child { width:60%; }
    .g-facecam-animee .c1 { background:#BFA88B; transform:rotate(-9deg); }
    .g-facecam-animee .c2 { background:#E9DCC8; transform:rotate(7deg); }
    .g-facecam-animee .c3 { background:#E9DCC8; transform:rotate(-4deg); flex-direction:row; align-items:flex-end; gap:10px; }
    .g-facecam-animee .c3 u { width:20px; background:#110A05; border-radius:6px; }
    .g-facecam-animee .c3 u:nth-child(1){height:36px} .g-facecam-animee .c3 u:nth-child(2){height:58px} .g-facecam-animee .c3 u:nth-child(3){height:80px;background:#BFA88B} .g-facecam-animee .c3 u:nth-child(4){height:100px}
    .g-facecam-animee .fa-trait { position:absolute; height:3px; border-radius:2px; background:rgba(233,220,200,.5); z-index:2; }
    .r169.g-facecam-animee .c1 { left:520px; top:130px; width:170px; height:190px; }
    .r169.g-facecam-animee .c2 { left:1110px; top:130px; width:140px; height:130px; }
    .r169.g-facecam-animee .c3 { left:1060px; top:400px; width:170px; height:150px; }
    .r169.g-facecam-animee .t1 { left:440px; top:200px; width:70px; } .r169.g-facecam-animee .t2 { left:470px; top:236px; width:40px; } .r169.g-facecam-animee .t3 { left:1000px; top:470px; width:50px; }
    .r916.g-facecam-animee .c1 { left:84px; top:600px; width:240px; height:260px; }
    .r916.g-facecam-animee .c2 { left:730px; top:620px; width:190px; height:180px; transform:rotate(8deg) }
    .r916.g-facecam-animee .c3 { left:670px; top:930px; width:240px; height:210px; }
    .r916.g-facecam-animee .t1 { left:350px; top:690px; width:90px; } .r916.g-facecam-animee .t2 { left:380px; top:730px; width:50px; } .r916.g-facecam-animee .t3 { left:640px; top:1030px; width:60px; }
    .g-facecam-animee .fa-etincelle { position:absolute; width:26px; height:26px; background:#E9DCC8; clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%); z-index:3; }
    .r169.g-facecam-animee .fa-etincelle { left:760px; top:90px; }
    .r916.g-facecam-animee .fa-etincelle { left:700px; top:880px; width:44px; height:44px; }
    .r916.g-facecam-animee .fa-carte svg { width:84px; height:84px; }
    .r916.g-facecam-animee .fa-carte i { height:14px; }`,
};

// PO — Entretien : deux portraits face à face, micro au centre, bande « on air »
window.GENERATEURS["podcast"] = {
  id: "podcast", code: "PO", etiquette: "Entretien", picto: "micro",
  titre: ["L'IA contre", "les *avocats*"],
  visuel: ({ v, insta }) => {
    const fond = photo("public/demo/decors/propositions/bureau-soir.jpg",
      `background-position:50% 55%;filter:saturate(.7) brightness(.62) sepia(.3) blur(${insta ? 1 : 3}px);transform:scale(1.1)`);
    const micro = (cl) => `<svg class="po-micro ${cl}" viewBox="0 0 120 320">
      <defs><linearGradient id="pm${cl}" x1="0" x2="1"><stop offset="0" stop-color="#3a2a22"/><stop offset=".5" stop-color="#6b5240"/><stop offset="1" stop-color="#1a120d"/></linearGradient></defs>
      <rect x="32" y="8" width="56" height="132" rx="28" fill="url(#pm${cl})" stroke="#E9DCC8" stroke-width="3"/>
      <path d="M36 44h48M36 62h48M36 80h48M36 98h48M36 116h48" stroke="#E9DCC8" stroke-opacity=".4" stroke-width="3"/>
      <rect x="32" y="148" width="56" height="12" rx="4" fill="#BFA88B"/>
      <path d="M14 96v28a46 46 0 0 0 92 0V96" fill="none" stroke="#E9DCC8" stroke-width="5" stroke-linecap="round"/>
      <path d="M60 170v100M30 278h60" stroke="#E9DCC8" stroke-width="6" stroke-linecap="round"/></svg>`;
    const hotes = insta ? `${micro("m1")}${micro("m2")}` :
      `<div class="po-p p1">${portrait({ x: 50, y: 0, h: 100, regard: 1 })}</div>
       <div class="po-p p2">${portrait({ x: 50, y: 0, h: 100, regard: -1 })}</div>${micro("m0")}`;
    return `${fond}<div class="po-lueur"></div>${hotes}
      <div class="po-air"><span></span><s></s><s></s><s></s></div>`;
  },
  style: `
    .g-podcast .po-lueur { position:absolute; inset:0; background:radial-gradient(18% 32% at 57% 40%, rgba(240,150,90,.5), transparent 75%), radial-gradient(18% 32% at 84% 40%, rgba(240,150,90,.5), transparent 75%); }
    .r916.g-podcast .po-lueur { background:radial-gradient(22% 20% at 28% 48%, rgba(240,150,90,.5), transparent 75%), radial-gradient(22% 20% at 72% 48%, rgba(240,150,90,.5), transparent 75%); }
    .g-podcast .po-p { position:absolute; overflow:hidden; }
    .g-podcast .po-p .portrait { left:50% !important; transform:translateX(-50%); }
    .g-podcast .po-p.p2 { transform:scaleX(-1); }
    .r169.g-podcast .po-p { top:130px; width:350px; height:500px; }
    .r169.g-podcast .po-p.p1 { left:560px; } .r169.g-podcast .po-p.p2 { left:900px; }
    .r169.g-podcast .po-p .portrait { height:560px !important; }
    .r916.g-podcast .po-p { top:600px; width:430px; height:600px; }
    .r916.g-podcast .po-p.p1 { left:60px; } .r916.g-podcast .po-p.p2 { left:530px; }
    .r916.g-podcast .po-p .portrait { height:680px !important; }
    .g-podcast .po-micro { position:absolute; z-index:3; filter:drop-shadow(0 20px 30px rgba(0,0,0,.6)); }
    .r169.g-podcast .po-micro.m0 { left:855px; top:250px; width:100px; height:266px; }
    .r916.g-podcast .po-micro.m0 { left:442px; top:700px; width:196px; height:522px; }
    .r169.g-podcast .po-micro.m1 { left:660px; top:130px; width:120px; height:320px; transform:rotate(-8deg); }
    .r169.g-podcast .po-micro.m2 { left:980px; top:130px; width:120px; height:320px; transform:scaleX(-1) rotate(-8deg); }
    .r916.g-podcast .po-micro.m1 { left:150px; top:540px; width:220px; height:587px; transform:rotate(-8deg); }
    .r916.g-podcast .po-micro.m2 { left:610px; top:540px; width:220px; height:587px; transform:scaleX(-1) rotate(-8deg); }
    .g-podcast .po-air { position:absolute; z-index:4; display:flex; align-items:center; gap:8px; background:rgba(17,10,5,.6); border:1.5px solid rgba(233,220,200,.3); padding:12px 16px; }
    .g-podcast .po-air span { width:12px; height:12px; border-radius:50%; background:#d9501f; margin-right:6px; }
    .g-podcast .po-air s { width:4px; border-radius:2px; background:rgba(233,220,200,.7); }
    .g-podcast .po-air s:nth-child(2){height:12px} .g-podcast .po-air s:nth-child(3){height:22px} .g-podcast .po-air s:nth-child(4){height:15px}
    .r169.g-podcast .po-air { right:50px; top:50px; }
    .r916.g-podcast .po-air { left:50%; top:1200px; transform:translateX(-50%) scale(1.5); }
    .r916.g-podcast .po-air { top:1120px; }`,
};

// WC — Format court : le portrait découpé en 3 bandes décalées (jump-cut) + lignes de vitesse
window.GENERATEURS["createur-b"] = {
  id: "createur-b", code: "WC", etiquette: "Format court", picto: "eclair",
  titre: ["Arrêtez de", "*tout* relire"],
  visuel: ({ v, insta }) => {
    const H = v ? 620 : 600, W = v ? 740 : 600;
    const decal = [-34, 30, -16];
    const fond = photo("public/demo/decors/propositions/bureau-jour.jpg", "background-position:50% 40%;filter:saturate(.7) brightness(.75) sepia(.3);transform:scale(1.2)");
    const bandes = decal.map((d, i) => `
      <div class="wc-b" style="top:${i * (H / 3)}px;height:${H / 3 - 8}px">
        <div class="wc-in" style="left:${d}px;top:${-i * (H / 3)}px;width:${W}px;height:${H}px">
          <div class="wc-fd">${insta ? fond : ""}</div>
          ${insta ? "" : portrait({ x: 50, y: 0, h: H * 1.06, unite: "px", style: "left:50%;transform:translateX(-50%)" })}
        </div></div>`).join("");
    return `<div class="wc-fond"></div>
      <div class="wc-vit" style="top:0"></div>
      <div class="wc-bandes" style="width:${W}px;height:${H}px">${bandes}</div>
      <i class="wc-l l1"></i><i class="wc-l l2"></i><i class="wc-l l3"></i><i class="wc-l l4"></i><i class="wc-l l5"></i>`;
  },
  style: `
    .g-createur-b .wc-fond { position:absolute; inset:0; background:radial-gradient(55% 70% at 72% 45%, rgba(180,79,41,.2), transparent 70%); }
    .g-createur-b .wc-bandes { position:absolute; }
    .r169.g-createur-b .wc-bandes { left:660px; top:50px; }
    .r916.g-createur-b .wc-bandes { left:150px; top:560px; }
    .g-createur-b .wc-b { position:absolute; left:0; right:0; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,.5); }
    .g-createur-b .wc-in { position:absolute; }
    .g-createur-b .wc-fd { position:absolute; inset:0; overflow:hidden; background:radial-gradient(60% 55% at 50% 28%, #6e4028, #2a160c 85%); }
    .g-createur-b .wc-fd .photo { filter:saturate(.7) brightness(.8) sepia(.3); }
    .g-createur-b .wc-l { position:absolute; height:2px; background:rgba(233,220,200,.55); }
    .r169.g-createur-b .l1 { left:500px; top:150px; width:140px; } .r169.g-createur-b .l2 { left:560px; top:330px; width:80px; }
    .r169.g-createur-b .l3 { left:1160px; top:260px; width:100px; } .r169.g-createur-b .l4 { left:1210px; top:420px; width:60px; } .r169.g-createur-b .l5 { left:540px; top:510px; width:100px; }
    .r916.g-createur-b .l1 { left:84px; top:640px; width:200px; } .r916.g-createur-b .l2 { left:84px; top:880px; width:120px; }
    .r916.g-createur-b .l3 { left:790px; top:760px; width:140px; } .r916.g-createur-b .l4 { left:850px; top:1000px; width:80px; } .r916.g-createur-b .l5 { left:84px; top:1110px; width:160px; }`,
};

// EP — Écran partagé : coupé en deux (16:9 visage à droite / 9:16 écran en haut, visage en bas), séparateur orange
window.GENERATEURS["ecran-partage"] = {
  id: "ecran-partage", code: "EP", etiquette: "Écran partagé", picto: "ecran",
  titre: ["Un devis en", "*2 minutes*"],
  visuel: ({ v, insta }) => {
    const fond = photo("public/demo/decors/propositions/bureau-jour.jpg",
      `background-position:50% 40%;filter:saturate(.7) brightness(.75) sepia(.3) blur(3px);transform:scale(1.1)`);
    const appli = `<div class="ep-fen"><div class="ep-barre"><s></s><s></s><s></s></div>
      <div class="ep-corps"><div class="ep-nav"><i></i><i></i><i></i></div>
        <div class="ep-doc"><div class="ep-ent"></div><i></i><i></i><i></i><i></i><div class="ep-total"><span></span><b>✓</b></div></div></div></div>`;
    return `<div class="ep-zone-visage">${fond}<div class="ep-lueur"></div>${insta ? "" : portrait(v ? { x: 66, y: 0, h: 640, unite: "px", style: "left:66%;transform:translateX(-50%);bottom:auto;top:-60px" } : { x: 82, y: 0, h: 112, style: "transform:translateX(-50%)" })}</div>
      <div class="ep-zone-ecran"><div class="ep-trame"></div></div>
      ${appli}<div class="ep-sep"></div>`;
  },
  style: `
    .g-ecran-partage .ep-lueur { position:absolute; inset:0; background:radial-gradient(34% 40% at 78% 28%, rgba(240,150,90,.5), transparent 75%); }
    .r916.g-ecran-partage .ep-lueur { background:radial-gradient(34% 70% at 66% 40%, rgba(240,150,90,.5), transparent 75%); }
    .g-ecran-partage .ep-zone-visage, .g-ecran-partage .ep-zone-ecran { position:absolute; overflow:hidden; }
    .g-ecran-partage .ep-zone-ecran { background:linear-gradient(160deg,#2a1810,#140a06); }
    .g-ecran-partage .ep-trame { position:absolute; inset:0; background:repeating-linear-gradient(0deg,rgba(233,220,200,.05) 0 1px,transparent 1px 40px),repeating-linear-gradient(90deg,rgba(233,220,200,.05) 0 1px,transparent 1px 40px); }
    .r169.g-ecran-partage .ep-zone-visage { inset:0; }
    .r169.g-ecran-partage .ep-zone-ecran { left:0; top:0; width:900px; height:720px; clip-path:polygon(0 0,100% 0,calc(100% - 90px) 100%,0 100%); }
    .r916.g-ecran-partage .ep-zone-visage { left:0; right:0; top:872px; height:320px; }
    .r916.g-ecran-partage .ep-zone-ecran { left:0; right:0; top:0; height:944px; clip-path:polygon(0 0,100% 0,100% calc(100% - 70px),0 100%); }
    .g-ecran-partage .ep-sep { position:absolute; background:#E9DCC8; z-index:3; box-shadow:0 0 30px rgba(233,220,200,.35); }
    .r169.g-ecran-partage .ep-sep { left:0; top:0; width:14px; height:900px; transform-origin:0 0; left:894px; transform:skewX(7.1deg) translateX(0); height:720px; }
    .r916.g-ecran-partage .ep-sep { left:0; right:0; top:872px; height:12px; transform:skewY(-4.1deg); transform-origin:100% 0; }
    .g-ecran-partage .ep-fen { position:absolute; z-index:2; border-radius:18px; background:linear-gradient(135deg, rgba(233,220,200,.62), rgba(233,220,200,.34)); border:1.5px solid rgba(233,220,200,.55);
      -webkit-backdrop-filter:blur(16px); backdrop-filter:blur(16px); box-shadow:0 70px 110px -10px rgba(0,0,0,.6), 0 18px 40px rgba(0,0,0,.35); overflow:hidden;
      transform:perspective(1100px) rotateY(-8deg) rotateX(4deg) rotate(-2deg); }
    .g-ecran-partage .ep-fen::after { content:""; position:absolute; inset:0; pointer-events:none; background:linear-gradient(115deg, rgba(255,255,255,.28), transparent 38%); }
    .r169.g-ecran-partage .ep-fen { left:420px; top:70px; width:430px; height:300px; }
    .r916.g-ecran-partage .ep-fen { left:190px; top:575px; width:700px; height:280px; }
    .g-ecran-partage .ep-barre { height:28px; background:rgba(17,10,5,.18); display:flex; align-items:center; gap:7px; padding-left:12px; }
    .g-ecran-partage .ep-barre s { width:10px; height:10px; border-radius:50%; background:#110A05; opacity:.55; }
    .g-ecran-partage .ep-barre s:first-child { background:#110A05; opacity:.9; }
    .g-ecran-partage .ep-corps { display:flex; height:calc(100% - 26px); }
    .g-ecran-partage .ep-nav { width:22%; background:rgba(17,10,5,.12); padding:16px 12px; display:flex; flex-direction:column; gap:12px; }
    .g-ecran-partage .ep-nav i { height:10px; border-radius:5px; background:rgba(17,10,5,.3); }
    .g-ecran-partage .ep-nav i:first-child { background:#110A05; }
    .g-ecran-partage .ep-doc { flex:1; padding:18px 22px; display:flex; flex-direction:column; gap:12px; }
    .g-ecran-partage .ep-ent { height:24px; width:46%; background:rgba(17,10,5,.78); border-radius:6px; }
    .g-ecran-partage .ep-doc i { height:10px; border-radius:5px; background:rgba(17,10,5,.26); }
    .g-ecran-partage .ep-doc i:nth-of-type(2n) { width:78%; }
    .g-ecran-partage .ep-total { margin-top:auto; height:46px; border-radius:12px; background:rgba(180,79,41,.72); display:flex; align-items:center; justify-content:space-between; padding:0 14px; }
    .g-ecran-partage .ep-total span { width:40%; height:12px; border-radius:6px; background:rgba(233,220,200,.6); }
    .g-ecran-partage .ep-total b { font:800 26px Montserrat; color:#E9DCC8; }`,
};

// UG — Avis client : téléphone vertical incliné (–6°), 5 étoiles, guillemet géant orange
window.GENERATEURS["ugc"] = {
  id: "ugc", code: "UG", etiquette: "Avis client", picto: "main",
  titre: ["Mes devis", "*filent* seuls"],
  visuel: ({ v, insta }) => {
    const fond = photo("public/demo/decors/propositions/bureau-doree.jpg",
      `background-position:50% 40%;filter:saturate(.75) brightness(.7) sepia(.3) blur(${insta ? 1 : 3}px)`);
    const ecran = insta
      ? `<div class="ug-avis"><i></i><i></i><i></i><i class="c"></i></div>`
      : `<div class="ug-p">${photo("public/demo/decors/propositions/bureau-soir.jpg", "background-position:50% 40%;filter:saturate(.7) brightness(.55) sepia(.3) blur(2px);transform:scale(1.2)")}${portrait({ x: 50, y: 0, h: 80, style: "transform:translateX(-50%);left:50%" })}</div>`;
    return `${fond}
      <div class="ug-guil">“</div>
      <div class="ug-tel"><div class="ug-ecran">${ecran}<div class="ug-notch"></div>
        <div class="ug-etoiles">${_etoiles(5, v ? 62 : 36)}</div></div></div>`;
  },
  style: `
    .g-ugc .ug-guil { position:absolute; font:800 760px/1 Montserrat; color:rgba(233,220,200,.22); }
    .r169.g-ugc .ug-guil { left:540px; top:20px; font-size:560px; }
    .r916.g-ugc .ug-guil { left:60px; top:500px; font-size:640px; }
    .g-ugc .ug-tel { position:absolute; transform:rotate(-6deg); border:7px solid #E9DCC8; border-radius:46px; background:#110A05; padding:0;
      box-shadow:0 50px 100px rgba(0,0,0,.65), 0 0 0 3px rgba(17,10,5,.8); overflow:hidden; z-index:3; }
    .r169.g-ugc .ug-tel { left:860px; top:40px; width:310px; height:600px; }
    .r916.g-ugc .ug-tel { left:480px; top:500px; width:420px; height:650px; border-radius:60px; border-width:9px; }
    .g-ugc .ug-ecran { position:absolute; inset:0; overflow:hidden; background:#1a0f08; }
    .g-ugc .ug-p { position:absolute; inset:0; overflow:hidden; }
    .g-ugc .ug-p .portrait { left:50% !important; }
    .g-ugc .ug-notch { position:absolute; left:50%; top:10px; width:86px; height:22px; margin-left:-43px; border-radius:12px; background:#000; }
    .g-ugc .ug-etoiles { position:absolute; left:0; right:0; bottom:70px; display:flex; justify-content:center; gap:4px; z-index:3; filter:drop-shadow(0 6px 10px rgba(0,0,0,.6)); }
    .g-ugc .ug-avis { position:absolute; inset:70px 26px 190px; display:flex; flex-direction:column; gap:20px; }
    .g-ugc .ug-avis i { display:block; height:16px; border-radius:8px; background:rgba(233,220,200,.35); }
    .g-ugc .ug-avis i:nth-child(2) { width:80%; } .g-ugc .ug-avis i:nth-child(3) { width:60%; }
    .g-ugc .ug-avis i.c { margin-top:auto; height:70px; border-radius:16px; background:rgba(191,168,139,.55); width:100%; }`,
};

// SE — Selfie : portrait dans un grand cercle cerclé d'orange, de biais, avec bulle de dialogue
window.GENERATEURS["selfie"] = {
  id: "selfie", code: "SE", etiquette: "Selfie", picto: "bulle",
  titre: ["Je vous", "*raconte* ça"],
  visuel: ({ v, insta }) => {
    const fond = photo("public/demo/decors/propositions/bureau-jour.jpg",
      `background-position:50% 40%;filter:saturate(.7) brightness(.45) sepia(.3) blur(4px);transform:scale(1.1)`);
    const dedans = insta
      ? `${photo("public/demo/decors/propositions/bureau-jour.jpg", "background-position:50% 60%;filter:saturate(.8) brightness(.85) sepia(.3)")}<svg class="se-pic" viewBox="0 0 24 24"><g fill="none" stroke="#E9DCC8" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${PICTOS.bulle}</g></svg>`
      : `${photo("public/demo/decors/propositions/bureau-jour.jpg", "background-position:50% 60%;filter:saturate(.8) brightness(.8) sepia(.3) blur(2px);transform:scale(1.25)")}${portrait({ x: 50, y: -16, h: 108, style: "transform:translateX(-50%)" })}<div class="se-bras"></div>`;
    return `${fond}
      <div class="se-bulle"><div class="se-cercle">${dedans}</div></div>
      <div class="se-dialogue"><s></s><s></s><s></s></div>`;
  },
  style: `
    .g-selfie .se-bulle { position:absolute; border-radius:50%; border:12px solid #BFA88B; box-shadow:0 40px 90px rgba(0,0,0,.6), 0 0 0 4px rgba(17,10,5,.6); transform:rotate(-7deg); overflow:hidden; background:#140a06; }
    .r169.g-selfie .se-bulle { left:690px; top:70px; width:540px; height:540px; }
    .r916.g-selfie .se-bulle { left:290px; top:520px; width:660px; height:660px; border-width:16px; }
    .g-selfie .se-cercle { position:absolute; inset:0; overflow:hidden; transform:rotate(7deg) scale(1.08); }
    .g-selfie .se-cercle .portrait { left:50% !important; }
    .g-selfie .se-bras { position:absolute; left:-6%; bottom:-6%; width:44%; height:26%; background:linear-gradient(120deg,#2a1810,#0e0805); border-radius:0 90% 0 0; transform:rotate(-24deg); transform-origin:0 100%; opacity:.9; }
    .g-selfie .se-pic { position:absolute; left:25%; top:25%; width:50%; height:50%; }
    .g-selfie .se-dialogue { position:absolute; z-index:4; background:#E9DCC8; border-radius:30px; display:flex; gap:12px; align-items:center; justify-content:center; box-shadow:0 20px 40px rgba(0,0,0,.5); transform:rotate(-6deg); }
    .g-selfie .se-dialogue::after { content:""; position:absolute; bottom:-22px; right:44px; width:36px; height:36px; background:#E9DCC8; clip-path:polygon(0 0,100% 0,60% 100%); }
    .g-selfie .se-dialogue s { width:16px; height:16px; border-radius:50%; background:#110A05; }
    .r169.g-selfie .se-dialogue { left:560px; top:110px; width:150px; height:84px; }
    .r916.g-selfie .se-dialogue { left:100px; top:560px; width:230px; height:130px; border-radius:46px; gap:18px; }
    .r916.g-selfie .se-dialogue s { width:24px; height:24px; }`,
};

// AV — redéfinit l'avocat de référence : vrai « deux caméras » (incrustation 2e angle) ; Instagram : balance au trait
window.GENERATEURS["avocat"] = {
  id: "avocat", code: "AV", etiquette: "Le droit expliqué", picto: "balance",
  titre: ["Licencié", "par *SMS* ?"],
  visuel: ({ v, insta }) => {
    const fond = photo("public/demo/decors/propositions/bureau-soir.jpg",
      `background-position:${v ? "50% 40%" : "50% 30%"};filter:saturate(.7) brightness(.8) sepia(.25) blur(${insta ? 0 : 2}px);transform:scale(1.05)`);
    if (insta) return `${fond}<svg class="av-balance" viewBox="0 0 24 24"><g fill="none" stroke="#E9DCC8" stroke-width=".3" stroke-linecap="round" stroke-linejoin="round">${PICTOS.balance}</g></svg>`;
    const second = photo("public/demo/decors/propositions/bureau-doree.jpg", "background-position:50% 50%;filter:saturate(.7) brightness(.7) sepia(.3);transform:scale(1.3)");
    return `${fond}<div class="av-lueur"></div>
      <svg class="av-balance2" viewBox="0 0 24 24"><g fill="none" stroke="#BFA88B" stroke-width=".3" stroke-linecap="round" stroke-linejoin="round">${PICTOS.balance}</g></svg>
      ${portrait(v ? { x: -4, y: 22, h: 52 } : { x: 40, y: 0, h: 104 })}
      <div class="av-inc">${second}${portrait({ x: 50, y: 0, h: 88, style: "left:50%;transform:translateX(-50%) scaleX(-1)" })}<i></i></div>`;
  },
  style: `
    .g-avocat .av-lueur { position:absolute; inset:0; background:radial-gradient(22% 30% at 64% 33%, rgba(240,150,90,.45), transparent 75%); }
    .r916.g-avocat .av-lueur { background:radial-gradient(34% 18% at 45% 43%, rgba(240,150,90,.45), transparent 75%); }
    .g-avocat .av-inc { position:absolute; overflow:hidden; border:3px solid #E9DCC8; box-shadow:0 34px 70px rgba(0,0,0,.7), 0 0 0 1px rgba(17,10,5,.6); z-index:3; background:#1a0f08; }
    .r169.g-avocat .av-inc { left:930px; top:290px; width:330px; height:186px; }
    .r916.g-avocat .av-inc { left:540px; top:930px; width:400px; height:225px; }
    .g-avocat .av-inc i { position:absolute; right:12px; top:12px; width:14px; height:14px; border-radius:50%; background:#d9501f; opacity:.85; }
    .g-avocat .av-balance2 { position:absolute; opacity:.35; }
    .r169.g-avocat .av-balance2 { left:564px; top:20px; width:520px; }
    .r916.g-avocat .av-balance2 { left:40px; top:580px; width:660px; }
    .g-avocat .av-balance { position:absolute; filter:drop-shadow(0 20px 40px rgba(0,0,0,.6)); }
    .r169.g-avocat .av-balance { left:640px; top:60px; width:560px; }
    .r916.g-avocat .av-balance { left:230px; top:530px; width:620px; }`,
};
