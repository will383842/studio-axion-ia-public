// Génère motion-v4/lot3/mots-demo.json à partir de listes compactes « MOT@début[*|#] » (* = mot fort, # = chiffre dit).
import { writeFileSync } from "node:fs";
const L = {
  FilEtape: "DEUXIÈME@0.30 ÉTAPE@0.60* LE@0.95 FORMAT@1.10* ON@1.55 CHOISIT@1.75* SELON@2.10 LA@2.30 PLATEFORME@2.40* ET@3.05 ON@3.2 AVANCE@3.35*",
  Chrono: "ÇA@0.25 PREND@0.45 DEUX@0.75# MINUTES@1.00*# POUR@1.55 CRÉER@1.75* UN@1.95 AGENT@2.05* ET@2.65 C'EST@2.8 PRÊT@3.0*",
  AvisEtoiles: "LÀ@0.25 L'AGENT@0.40 DEVIENT@0.70 NIVEAU@1.00* EXPERT@1.45* CINQ@1.80# SUR@2.00 CINQ@2.15# C'EST@2.7 BON@2.9*",
  EclatChiffre: "AVANT,@0.10 ÇA@0.45 PRENAIT@0.60 45@0.90# MINUTES@1.55* PAR@1.85 DEVIS@2.00* ET@2.7 MAINTENANT@2.85*",
  PageWebDefile: "VOILÀ@0.25 LA@0.50 PAGE@0.62* QU'IL@0.90 A@1.00 CONSTRUITE@1.10* EN@1.70 UNE@1.85# HEURE@2.00*# TOUT@2.75 SEUL@2.95*",
  CarrouselFeuillete: "IL@0.05 ME@0.20 SORT@0.30 UN@0.45 CARROUSEL@0.60* ENTIER@1.10* À@1.55 MA@1.65 CHARTE@1.75* PRÊT@2.30 À@2.50 PUBLIER@2.60* DIRECT@3.1*",
  JaugePourcentage: "IL@0.25 ME@0.40 SORT@0.50 LA@0.75 VIDÉO@0.85* MONTÉE@1.10* PRÊTE@1.60 À@1.80 CENT@1.95*# POUR@2.15 CENT@2.30# ET@2.9 HOP@3.05*",
  PileNotifications: "JE@0.15 RELANCE@0.30* LE@0.55 CLIENT@0.65 RÉPOND@0.80* LE@1.10 DEVIS@1.25 SIGNÉ@1.40* ARRIVE@1.70 ET@2.0 TOUT@2.15 SEUL@2.3*",
  enchainement:
    "MON@0.00 AGENT@0.20 VIDÉO@0.42* ME@0.80 SORT@1.00 LE@1.20 MONTAGE@1.35* PRÊT@1.75 À@1.95 CENT@2.10# POUR@2.30 CENT@2.45# " +
    "NIVEAU@2.70* EXPERT@2.95* CINQ@3.30# SUR@3.50 CINQ@3.62# " +
    "DEUXIÈME@3.90 ÉTAPE@4.20* LE@4.55 FORMAT@4.70* " +
    "ÇA@5.10 PREND@5.25 DEUX@5.45# MINUTES@5.65*# POUR@6.00 CRÉER@6.15* UN@6.30 AGENT@6.40* " +
    "VOILÀ@6.60 LA@6.80 PAGE@6.90* QU'IL@7.15 A@7.30 CONSTRUITE@7.40* EN@7.85 UNE@8.00# HEURE@8.10*# " +
    "JE@8.50 RELANCE@8.62* LE@8.95 CLIENT@9.05 RÉPOND@9.25* LE@9.55 DEVIS@9.65 SIGNÉ@9.80* " +
    "45@10.45# MINUTES@11.15* PAR@11.40 DEVIS@11.55* " +
    "CARROUSEL@11.90* ENTIER@12.25* À@12.55 MA@12.65 CHARTE@12.80* PRÊT@13.15 À@13.35 PUBLIER@13.45* " +
    "COMMENTEZ@14.20* RELANCE@14.50*",
};
const out = {};
for (const [id, s] of Object.entries(L)) {
  const mots = s.split(" ").map((x) => {
    const m = x.match(/^(.+)@([\d.]+)([*#]*)$/);
    return { mot: m[1], debut: Number(m[2]), fort: m[3].includes("*"), chiffre: m[3].includes("#") };
  });
  out[id] = mots.map((w, k) => ({ mot: w.mot, debut: w.debut, fin: +(k + 1 < mots.length ? Math.min(mots[k + 1].debut - 0.03, w.debut + 0.45) : w.debut + 0.4).toFixed(2), fort: w.fort, chiffre: w.chiffre }));
}
const dest = process.argv[2];
writeFileSync(dest, JSON.stringify(out, null, 1));
console.log(Object.entries(out).map(([k, v]) => `${k}: ${v.length} mots`).join(", "));
