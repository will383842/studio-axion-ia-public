/**
 * IMP-1 — RAPPORT D'IMPORT (PUR, sans secret) : comptes × jours × premier commentaire sur la période, mots interdits
 * sur TOUS les champs (texte, premier commentaire, titres, textes alternatifs), titres de document > 60 signes,
 * liens joints. Le rapport ne recopie jamais un texte de post : seulement des identifiants, champs et libellés.
 */
import { motsInterditsEnvoi } from "../../fournisseurs/publication/mots-interdits-envoi";
import type { CanalBuffer, PostBuffer } from "./types";

export const PERIODE_DEFAUT = { du: "2026-11-06", au: "2026-11-18" } as const;
export const TITRE_PDF_MAX = 60;

export interface CelluleJour {
  total: number;
  avecPremierCommentaire: number;
  sansPremierCommentaire: number;
}

export interface LigneCompte {
  canalId: string;
  nom: string;
  service: string;
  jours: Record<string, CelluleJour>;
}

export interface AlerteMotInterdit {
  postId: string;
  champ: "texte" | "premier commentaire" | "titre" | "titre de document" | "titre de vidéo" | "texte alternatif" | "lien";
  mots: string[];
}

export interface Rapport {
  periode: { du: string; au: string };
  jours: string[];
  comptes: LigneCompte[];
  horsPeriode: number;
  motsInterdits: AlerteMotInterdit[];
  titresPdfLongs: { postId: string; longueur: number }[];
  liensJoints: { postId: string; canalId: string }[];
}

/** Jours AAAA-MM-JJ de `du` à `au` inclus (UTC). */
export function joursDe(du: string, au: string): string[] {
  const res: string[] = [];
  for (let t = Date.parse(`${du}T00:00:00Z`); t <= Date.parse(`${au}T00:00:00Z`) && res.length < 400; t += 86_400_000) res.push(new Date(t).toISOString().slice(0, 10));
  return res;
}

const cellule = (): CelluleJour => ({ total: 0, avecPremierCommentaire: 0, sansPremierCommentaire: 0 });

export function construireRapport(posts: PostBuffer[], canaux: CanalBuffer[], periode: { du: string; au: string } = PERIODE_DEFAUT): Rapport {
  const jours = joursDe(periode.du, periode.au);
  const lignes = new Map<string, LigneCompte>();
  const ligne = (id: string): LigneCompte => {
    let l = lignes.get(id);
    if (!l) {
      const c = canaux.find((x) => x.id === id);
      l = { canalId: id, nom: c?.nom ?? "Compte inconnu", service: c?.service ?? "", jours: Object.fromEntries(jours.map((j) => [j, cellule()])) };
      lignes.set(id, l);
    }
    return l;
  };
  for (const c of canaux) ligne(c.id);
  const rapport: Rapport = { periode, jours, comptes: [], horsPeriode: 0, motsInterdits: [], titresPdfLongs: [], liensJoints: [] };

  const verifier = (postId: string, champ: AlerteMotInterdit["champ"], valeur: string | undefined) => {
    if (!valeur) return;
    const mots = motsInterditsEnvoi(valeur);
    if (mots.length) rapport.motsInterdits.push({ postId, champ, mots });
  };

  for (const p of posts) {
    const jour = p.dateUtc?.slice(0, 10);
    if (jour && jours.includes(jour)) {
      const c = ligne(p.canalId).jours[jour];
      c.total++;
      if (p.premierCommentaire?.trim()) c.avecPremierCommentaire++;
      else c.sansPremierCommentaire++;
    } else rapport.horsPeriode++;

    verifier(p.id, "texte", p.texte);
    verifier(p.id, "premier commentaire", p.premierCommentaire);
    verifier(p.id, "titre", p.titre);
    for (const m of p.medias) {
      if (m.type === "image") verifier(p.id, "texte alternatif", m.texteAlternatif);
      if (m.type === "document") {
        verifier(p.id, "titre de document", m.titre);
        if (m.titre && [...m.titre].length > TITRE_PDF_MAX) rapport.titresPdfLongs.push({ postId: p.id, longueur: [...m.titre].length });
      }
      if (m.type === "video") verifier(p.id, "titre de vidéo", m.titre);
    }
    if (p.lienJoint) {
      rapport.liensJoints.push({ postId: p.id, canalId: p.canalId });
      verifier(p.id, "lien", p.lienJoint.titre);
    }
  }
  rapport.comptes = [...lignes.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  return rapport;
}

/** Rapport lisible (console ou fichier). */
export function formaterRapport(r: Rapport): string {
  const L: string[] = [`Rapport d'import Buffer — période du ${r.periode.du} au ${r.periode.au} (UTC)`, ""];
  L.push("Comptes × jours (posts / dont avec premier commentaire) :");
  for (const c of r.comptes) {
    const jours = r.jours.filter((j) => c.jours[j].total > 0).map((j) => `${j.slice(5)} : ${c.jours[j].total}/${c.jours[j].avecPremierCommentaire}`);
    L.push(`- ${c.nom} (${c.service || "?"}) : ${jours.length ? jours.join(" ; ") : "aucun post"}`);
  }
  L.push("", `Posts hors période : ${r.horsPeriode}`);
  L.push(`Mots interdits : ${r.motsInterdits.length ? "" : "aucun"}`);
  for (const m of r.motsInterdits) L.push(`  - post ${m.postId}, ${m.champ} : ${m.mots.join(", ")}`);
  L.push(`Titres de PDF de plus de ${TITRE_PDF_MAX} signes : ${r.titresPdfLongs.length ? "" : "aucun"}`);
  for (const t of r.titresPdfLongs) L.push(`  - post ${t.postId} : ${t.longueur} signes`);
  L.push(`Liens joints (linkAttachment) : ${r.liensJoints.length ? "" : "aucun"}`);
  for (const l of r.liensJoints) L.push(`  - post ${l.postId}`);
  return L.join("\n");
}
