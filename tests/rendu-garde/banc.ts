/**
 * BANC du délai de garde (incident du 12/10) : moteur du tableau animé à DEUX verticaux (Instagram et TikTok), doubles
 * seulement (aucun appel payant), avec un serveur de rendu dont on choisit l'état de chaque demande.
 */
import type { CommandeFabrication, Travail } from "../../src/domaine/types";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "../../src/fournisseurs/types";
import { creerMoteurMontageTableau, type OutilsTableau } from "../../src/moteurs/montage-tableau";
import type { IdSortie } from "../../src/moteurs/montage-tableau/formats-sortie";
import { finEtAppelDuTableau, reseauDeLaSortie } from "../../src/services/tableau-fin";
import { TABLE_FINS } from "../../src/briques/fins";
import { commandeTableau } from "../../src/moteurs/montage-tableau/fabriquer";
import { doubles } from "../tableau/fabriquer/doubles";
import { versOutils } from "../tableau/moteur/doubles";
import { texteScriptDe } from "../tableau/regles/exemples";
import { contexteFormation, ficheFormation } from "../tableau/style-v2/temoin-formation";

export const estScene = (d: DemandeRendu) => d.operation === "composition" && (d.parametres as { mode?: string }).mode === undefined;
export const estComplet = (d: DemandeRendu) => d.operation === "composition" && (d.parametres as { mode?: string }).mode === "complet";

/** Horloge commune au moteur et au délai de garde des rendus (ms). */
export const horloge = { t: Date.UTC(2026, 9, 12, 9, 0, 0) };

/**
 * Banc à deux verticaux. `rater(d, compositions)` : l'état que le serveur garde pour cette demande (null : le double
 * ordinaire, « terminé » tout de suite). `extra(o)` : outils en plus (délai de garde…).
 */
export function bancDeuxVerticaux(rater: (d: DemandeRendu, compositionsSoumises: number) => EtatRendu | null, extra: (o: OutilsTableau) => Partial<OutilsTableau> = () => ({})) {
  const fiche = { ...ficheFormation(), appelId: "fin-if-mot-envoi" };
  const d = doubles(fiche);
  const base = d.outils.scenes.rendu();
  const etats = new Map<string, EtatRendu>();
  let compositions = 0;
  const soumises: DemandeRendu[] = [];
  const panne = { active: true };
  const rendu: ServiceRendu = {
    async soumettre(dem) {
      if (estComplet(dem)) compositions++;
      soumises.push(dem);
      const etat = panne.active ? rater(dem, compositions) : null;
      if (etat) {
        etats.set(dem.idRendu, etat);
        return { idRendu: dem.idRendu };
      }
      etats.delete(dem.idRendu);
      return base.soumettre(dem);
    },
    async etat(id) {
      return etats.get(id) ?? base.etat(id);
    },
  };
  const finsReelles = (appelId: string | null, sortie: IdSortie) => finEtAppelDuTableau(reseauDeLaSortie(sortie, {}, ["vertical", "vertical-liens"]), appelId, TABLE_FINS, { mot: "CINQ" });
  const fiches = new Map<string, typeof fiche>();
  const moteur = creerMoteurMontageTableau({
    outils: async () => {
      const o = versOutils(d, fiches);
      const { texteScript, ...contexte } = contexteFormation();
      void texteScript;
      const avecRendu: OutilsTableau = { ...o, contexte, sorties: ["vertical", "vertical-liens"], choisirFin: finsReelles, scenes: { ...o.scenes, rendu: () => rendu }, montage: { ...o.montage, rendu: () => rendu } };
      return { ...avecRendu, ...extra(avecRendu) };
    },
  });
  const cle = `studio/dev/fiches/${fiche.videoId}/1.json`;
  fiches.set(cle, structuredClone(fiche));
  const commande: CommandeFabrication = { ...commandeTableau({ videoId: fiche.videoId, fiche, texteScript: texteScriptDe(fiche), dureeSec: 30, centreSousTitresPct: 80, scenes: [], personnageId: "williams" }), entrees: { tableau: { ficheScenesCle: cle, empreinte: "e1", version: 1 } } };
  return {
    moteur,
    commande,
    d,
    etats,
    soumises,
    /** Fin de la panne : les demandes suivantes aboutissent. */
    reparer: () => void (panne.active = false),
    scenesSoumises: () => soumises.filter(estScene).map((x) => x.idRendu),
    compositionsSoumises: () => soumises.filter(estComplet).map((x) => x.idRendu),
  };
}

/** Avance tour après tour (aller-retour JSON, comme en base), `pasMs` entre deux tours ; s'arrête à « termine » ou « echec ». */
export async function tourner(moteur: ReturnType<typeof creerMoteurMontageTableau>, commande: CommandeFabrication, depart: Travail, tours = 300, pasMs = 5_000) {
  let t = depart;
  let n = 0;
  for (; n < tours; n++) {
    horloge.t += pasMs;
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, horloge.t);
    t = r.travail;
    if (t.statut === "termine" || t.statut === "echec") return { travail: t, tours: n + 1, resultat: r.resultat };
  }
  return { travail: t, tours: n, resultat: undefined };
}

export const ctx = (travailId: string) => ({ travailId, versionId: `ver-${travailId}`, titre: "Essai", maintenant: horloge.t });

export const TARGET_CLOSED: EtatRendu = { statut: "echec", erreur: { code: "inconnu", reessayable: true, message: "Protocol error (Page.bringToFront): Target closed. https://www.remotion.dev/docs/target-closed" } };
