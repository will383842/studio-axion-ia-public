// Variantes de RÉFÉRENCE écrites par le directeur artistique.
// Chaque générateur ne fournit que : étiquette + picto, titre, et le calque « visuel ».
// Tout le reste (liseré, coin, titre, lumière, grain, signature) vient du socle.
// Après les relectures, « avocat » est redéfini dans variantes-visage.js et « cas-concret »
// dans variantes-sans-visage.js (chargés après ce fichier) : ces deux versions sont celles du tour 0.

// AV — Vidéo type avocat : bibliothèque sombre, Will à droite, cadrage « deux caméras »
window.GENERATEURS["avocat"] = {
  id: "avocat", code: "AV", etiquette: "Le droit expliqué", picto: "balance",
  titre: ["Licencié", "par *SMS* ?"],
  visuel: ({ v, insta }) => `
    ${photo("public/demo/decors/propositions/bureau-soir.jpg", `background-position:${v ? "50% 40%" : "50% 30%"};filter:saturate(.7) brightness(.62) sepia(.25) blur(${insta ? 0 : 2}px);transform:scale(1.05)`)}
    ${insta ? "" : portrait(v ? { x: 14, y: 22, h: 52 } : { x: 52, y: 0, h: 104 })}
    <div class="av-cadre"></div>`,
  style: `
    .g-avocat .av-cadre { position:absolute; border:2px solid rgba(233,220,200,.28); }
    .r169.g-avocat .av-cadre { right:44px; top:44px; width:300px; height:170px; }
    .r169.g-avocat .av-cadre::after { content:"REC"; position:absolute; right:12px; top:10px; font:700 15px Inter; letter-spacing:.2em; color:#E9DCC8; padding-left:18px;
      background:radial-gradient(circle at 5px 50%, #B44F29 5px, transparent 6px); }
    .r916.g-avocat .av-cadre { display:none; }`,
};

// CC — Cas concret : aucun visage, l'automatisation dessinée en 3 étapes reliées
window.GENERATEURS["cas-concret"] = {
  id: "cas-concret", code: "CC", etiquette: "Cas concret", picto: "rouages",
  titre: ["Le blog qui", "*s'écrit* seul"],
  visuel: ({ v }) => `
    <div class="cc-fond"></div>
    <div class="cc-flux">
      <div class="cc-etape"><b>1</b><i></i><i></i></div>
      <div class="cc-lien"></div>
      <div class="cc-etape"><b>2</b><i></i><i></i><i></i></div>
      <div class="cc-lien"></div>
      <div class="cc-etape cc-fin"><b>✓</b><i></i><i></i></div>
    </div>`,
  style: `
    .g-cas-concret .cc-fond { position:absolute; inset:0;
      background: radial-gradient(60% 60% at 70% 40%, rgba(180,79,41,.22), transparent 70%),
        repeating-linear-gradient(0deg, rgba(233,220,200,.045) 0 1px, transparent 1px 48px),
        repeating-linear-gradient(90deg, rgba(233,220,200,.045) 0 1px, transparent 1px 48px); }
    .g-cas-concret .cc-flux { position:absolute; display:flex; align-items:center; }
    .r169.g-cas-concret .cc-flux { right:60px; top:150px; transform:rotate(-6deg); }
    .r916.g-cas-concret .cc-flux { left:50%; top:600px; transform:translateX(-50%) rotate(-6deg) scale(1.15); flex-direction:column; }
    .g-cas-concret .cc-etape { width:150px; height:190px; border-radius:18px; padding:20px 18px;
      background:linear-gradient(160deg, rgba(233,220,200,.16), rgba(233,220,200,.05)); border:1.5px solid rgba(233,220,200,.3);
      box-shadow:0 30px 60px rgba(0,0,0,.5); display:flex; flex-direction:column; gap:12px; }
    .g-cas-concret .cc-etape b { width:44px; height:44px; border-radius:50%; display:grid; place-items:center;
      font:800 22px Montserrat; color:#110A05; background:#E9DCC8; }
    .g-cas-concret .cc-etape i { display:block; height:10px; border-radius:5px; background:rgba(233,220,200,.32); }
    .g-cas-concret .cc-etape i:nth-of-type(2) { width:70%; }
    .g-cas-concret .cc-fin { background:linear-gradient(160deg, #B44F29, #7d3317); border-color:#d9744a; }
    .g-cas-concret .cc-fin b { background:#110A05; color:#E9DCC8; }
    .g-cas-concret .cc-lien { width:56px; height:4px; background:#B44F29; position:relative; }
    .r916.g-cas-concret .cc-lien { width:4px; height:40px; }
    .r916.g-cas-concret .cc-etape { width:300px; height:150px; flex-direction:row; align-items:center; flex-wrap:wrap; align-content:center; }
    .r916.g-cas-concret .cc-etape i { width:150px; }`,
};
