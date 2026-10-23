// Essai du réalisateur sur une prise réelle (outil de mise au point, aucun appel réseau) : prépare la requête, puis rejoue le
// déroulé réel avec les réponses déposées (reponse-1.json, reponse-2.json…).
// Usage : DOSSIER_ESSAI=… [PRISE_SRC=prise-large.mp4 YEUX=0.302 CENTRE_X=0.41 LARGEUR_VISAGE=0.39] tsx scripts/essai-realisateur.ts preparer|rejouer
// Autre texte (preuve de variation) : MOTS_JSON=<mots {w,a,f}> DUREE=<s> FIN_PRISE=<s> TITRE=… ; HISTORIQUE_PLAN=<plan.json de la
// vidéo précédente> (plusieurs : séparés par « ; », le plus récent en premier) passe l'historique au réalisateur.
// `rejouer` écrit plan.json (le plan livré) et resultat.json (version, essais, erreurs, avertissements, mesures).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { historiqueDuPlan, realiser, messageRealisateur, schemaSortieRealisateur, type EntreeRealisateur } from "../src/moteurs/montage-facecam-animee/realisateur/index";
import { consigneRealisateur } from "../src/moteurs/montage-facecam-animee/realisateur/consignes";
import { schemaJson } from "../src/generateur/roles/types";

const D = process.env.DOSSIER_ESSAI ?? "essai-realisateur";
const nombre = (x: string | undefined) => (x !== undefined && x !== "" && Number.isFinite(Number(x)) ? Number(x) : undefined);
const mots = JSON.parse(readFileSync(process.env.MOTS_JSON ?? "<dossier utilisateur>/Documents/Projets/studio-interface-claire/tests/facecam-animee/fixtures/mots-img7747.json", "utf8"));
const historique = (process.env.HISTORIQUE_PLAN ?? "").split(";").filter(Boolean).map((f) => historiqueDuPlan(JSON.parse(readFileSync(f, "utf8"))));
const centreX = nombre(process.env.CENTRE_X);
const largeurVisage = nombre(process.env.LARGEUR_VISAGE);
const yeux = nombre(process.env.YEUX);
const entree: EntreeRealisateur = {
  mots, dureeSec: nombre(process.env.DUREE) ?? 93, titre: process.env.TITRE ?? "Le diagnostic fuite",
  ...(historique.length ? { historique } : {}),
  prise: { src: process.env.PRISE_SRC ?? "prise.mp4", finSec: nombre(process.env.FIN_PRISE) ?? 91.1, ...(yeux !== undefined ? { yeux } : {}), ...(centreX !== undefined ? { centreX } : {}), ...(largeurVisage !== undefined ? { largeurVisage } : {}) },
  fin: { marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: ["former", "boussole", "loupe", "eclair"], appel: "Le lien en commentaire" },
};
async function principal() {
  const mode = process.argv[2];
  if (mode === "preparer") {
    writeFileSync(D + "/systeme.txt", consigneRealisateur(entree.historique ?? []));
    writeFileSync(D + "/message.txt", messageRealisateur(entree));
    writeFileSync(D + "/schema.json", JSON.stringify(schemaJson(schemaSortieRealisateur), null, 1));
    console.log("prêt");
  } else {
    // Rejoue le déroulé réel : chaque appel rend la réponse n° i (reponse-1.json, reponse-2.json…) ; les messages envoyés sont écrits.
    let i = 0;
    const r = await realiser(entree, {
      appeler: async (req) => {
        i++;
        writeFileSync(D + "/message-envoye-" + i + ".txt", req.message);
        const f = D + "/reponse-" + i + ".json";
        if (!existsSync(f)) return { ok: false, message: "réponse " + i + " absente (essai suivant à produire)" };
        return { ok: true, donnees: JSON.parse(readFileSync(f, "utf8")) };
      },
    });
    writeFileSync(D + "/plan.json", JSON.stringify(r.plan, null, 1));
    const resultat = { version: r.version, essais: r.essais, erreurs: r.erreurs, avertissements: r.avertissements, mesures: r.mesures, phrase: r.phrase };
    writeFileSync(D + "/resultat.json", JSON.stringify(resultat, null, 1));
    console.log(JSON.stringify(resultat, null, 1));
  }
}

void principal();
