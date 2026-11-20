/**
 * C10-13-v19b : le bouton « Prendre rendez-vous » cliqué entre au registre des petits objets (rien d'autre).
 * Aucune vidéo ne change : la pièce n'est pas au catalogue du plan de scènes, et `objet.appel` n'est permis nulle part.
 * La vraie `adapterPlan` est appelée avec un Claude SIMULÉ (aucun appel réel, aucun euro).
 */
import { describe, expect, it } from "vitest";
import { ID } from "@/briques/bibliotheque-video/noms";
import { PROFILS_DU_CODE, profilNeutre } from "@/briques/bibliotheque-video/profils";
import type { EntreeBibliotheque, ProfilVideo, RegleProfilCapacite } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import { verifierDefinition } from "@/briques/motion/petits-objets/contrat";
import { adapterPlan, type EntreeAdaptateur } from "@/briques/plan-scenes-generateurs/adaptateur";
import { IDS_PIECES } from "@/briques/plan-scenes/catalogue";
import type { MotMinute } from "@/briques/plan-scenes/schema";
import { piecesPermisesDesEntrees } from "@/briques/plan-scenes-objets/pieces-permises";
import { definitionObjet, idsObjets } from "@/briques/plan-scenes-objets/registre";

const RDV = "objet-appel-rdv";

function entrees(capacites: Partial<Record<string, RegleProfilCapacite>> = {}) {
  const profil: ProfilVideo = { ...profilNeutre("format-essai"), capacites: capacites as ProfilVideo["capacites"], verrous: [] };
  const e: EntreeBibliotheque = { version: VERSION_BIBLIOTHEQUE, profil, recents: [], graine: "G", figeeLe: "2026-11-19" };
  return { bibliothequeVideo: e };
}

describe("C10-13-v19b · registre : objet-appel-rdv", () => {
  it("(a) inscrit, définition valide, liste des ids triée", () => {
    expect(definitionObjet(RDV)?.id).toBe(RDV);
    expect(verifierDefinition(definitionObjet(RDV)!)).toBe("ok");
    const ids = idsObjets();
    expect(ids).toContain(RDV);
    expect([...ids]).toEqual([...ids].sort());
  });

  it("(b) objet.appel permis → les trois pièces d'appel ; éteint = identique", () => {
    const r = piecesPermisesDesEntrees(entrees({ [ID.objetAppel]: { permis: true } }));
    expect(r).toContain(RDV);
    expect(r).toContain("objet-appel-action");
    expect(r).toContain("objet-appel-mot");
    expect(piecesPermisesDesEntrees({})).toEqual([]);
    expect(piecesPermisesDesEntrees(entrees({}))).toEqual([]);
    const reel: EntreeBibliotheque = { version: VERSION_BIBLIOTHEQUE, profil: PROFILS_DU_CODE["cas-concret"], recents: [], graine: "G", figeeLe: "2026-11-19" };
    expect(piecesPermisesDesEntrees({ bibliothequeVideo: reel })).toEqual([]);
  });

  it("(c) inscrit au catalogue du plan (C9-34-FIN-v20h), porte fermée : sans permis la consigne ne change pas d'un caractère ; permise seulement, elle apparaît", async () => {
    expect(IDS_PIECES as readonly string[]).toContain(RDV);
    const permis = piecesPermisesDesEntrees(entrees({ [ID.objetAppel]: { permis: true } }));
    expect(permis).toContain(RDV);
    const sans = permis.filter((id) => id !== RDV);
    const phrase = "Bonjour à tous. On gagne 3 heures par semaine avec cet outil. Le devis part tout seul chaque matin.";
    const mots: MotMinute[] = phrase.split(/\s+/).map((t, i) => ({ texte: t, debutMs: i * 400, finMs: i * 400 + 350 }));
    const entree = (objetsPermis: readonly string[]): EntreeAdaptateur => ({ generateur: "cas-concret", script: phrase, segments: [{ texte: phrase, debutMs: 0, finMs: mots.at(-1)!.finMs, mots }], format: { largeur: 1080, hauteur: 1920, fps: 25 }, facecam: false, objetsPermis });
    const consigne = async (objetsPermis: readonly string[]) => {
      const appels: unknown[] = [];
      const appeler = async (req: unknown) => (appels.push(req), { texte: "{}", stopReason: "end_turn" }) as never;
      await adapterPlan(entree(objetsPermis), { appeler });
      return JSON.stringify(appels);
    };
    const avec = await consigne(permis);
    expect(avec.length).toBeGreaterThan(2);
    // C9-34-FIN-v20h : attente ÉLARGIE (aucune garde retirée) : l'objet est inscrit, donc la consigne le liste quand il est permis ;
    // la garde « porte fermée » reste : sans permis (liste vide ou absente) la consigne est identique et ne cite pas l'objet.
    expect(avec).toContain(RDV);
    expect(await consigne(sans)).not.toContain(RDV);
    expect(await consigne([])).not.toContain(RDV);
    expect(await consigne(sans)).not.toBe(avec);
  });
});
