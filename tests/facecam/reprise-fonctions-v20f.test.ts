/**
 * T-REPRISE-FACECAM-v20f · tests directs des 7 fonctions de `montage-facecam/reprise.ts` jusque-là sans test :
 * suiviFige, sansVeille, lireCarteGardee, sansReprise, suiviSansEssai, prochaineSoumission, apresSoumission.
 * Entrées construites à la main, faux service de rendu, aucun réseau, aucune horloge réelle.
 */
import { describe, expect, it, vi } from "vitest";
import {
  ATTENTE_INJOIGNABLE_MS,
  RELANCES_MEME_ID_MAX,
  apresSoumission,
  lireCarteGardee,
  prochaineSoumission,
  sansReprise,
  sansVeille,
  suiviFige,
  suiviSansEssai,
} from "@/moteurs/montage-facecam/reprise";
import type { SuiviTravail } from "@/moteurs/montage-facecam/chaine";
import type { EtatTravailFacecam } from "@/fournisseurs/facecam/client";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";

const MAINTENANT = 1_700_000_000_000;

const suivi = (extra: Partial<SuiviTravail> = {}): SuiviTravail => ({ id: "t-1", statut: "soumis", essais: 1, ...extra });

const echecFacecam = (erreur: Partial<Extract<EtatTravailFacecam, { statut: "echec" }>["erreur"]> = {}): EtatTravailFacecam => ({
  statut: "echec",
  erreur: { code: "indisponible", reessayable: true, message: "panne", ...erreur },
});

describe("suiviFige", () => {
  const fige = suivi({ statut: "soumis", essais: 1, progression: 40, derniereProgression: 40, progresDepuis: "2026-11-20T10:00:00.000Z", injoignableDepuis: 5, memeId: true, relances: 2 });

  it("réessayable tant qu'il reste des essais, sans marques de progrès ni de reprise", () => {
    const r = suiviFige(fige, 22, 3);
    expect(r).toEqual({
      id: "t-1",
      statut: "echec",
      progression: 40,
      essais: 1,
      relances: 2,
      erreur: { code: "sans-progres", message: "Le travail du serveur de montage n'a pas avancé depuis 22 min.", reessayable: true },
    });
    expect("derniereProgression" in r).toBe(false);
    expect("progresDepuis" in r).toBe(false);
    expect("injoignableDepuis" in r).toBe(false);
    expect("memeId" in r).toBe(false);
  });

  it("échec définitif quand les essais max sont atteints (essais === max)", () => {
    expect(suiviFige(suivi({ essais: 3 }), 20, 3).erreur).toEqual({ code: "sans-progres", message: "Le travail du serveur de montage n'a pas avancé depuis 20 min.", reessayable: false });
  });

  it("dernier essai possible : essais = max - 1 reste réessayable", () => {
    expect(suiviFige(suivi({ essais: 2 }), 20, 3).erreur?.reessayable).toBe(true);
  });

  it("ne mute pas l'entrée", () => {
    const avant = structuredClone(fige);
    suiviFige(fige, 22, 3);
    expect(fige).toEqual(avant);
  });
});

describe("sansVeille", () => {
  it("retire les marques de progrès ET de reprise, garde le reste", () => {
    const t = suivi({ progression: 10, derniereProgression: 10, progresDepuis: "2026-11-20T10:00:00.000Z", injoignableDepuis: 7, memeId: true, relances: 1 });
    expect(sansVeille(t)).toEqual({ id: "t-1", statut: "soumis", essais: 1, progression: 10, relances: 1 });
  });

  it("idempotent : un suivi déjà sans veille reste identique", () => {
    const propre = suivi({ progression: 10 });
    const une = sansVeille(propre);
    expect(une).toEqual({ id: "t-1", statut: "soumis", essais: 1, progression: 10 });
    expect(sansVeille(une)).toEqual(une);
  });

  it("ne mute pas l'entrée et rend un autre objet", () => {
    const t = suivi({ derniereProgression: 3, progresDepuis: "x" });
    const avant = structuredClone(t);
    const r = sansVeille(t);
    expect(t).toEqual(avant);
    expect(r).not.toBe(t);
  });
});

describe("sansReprise", () => {
  it("retire injoignableDepuis et memeId seulement", () => {
    const t = suivi({ injoignableDepuis: 9, memeId: true, relances: 2, derniereProgression: 5, progresDepuis: "p" });
    expect(sansReprise(t)).toEqual({ id: "t-1", statut: "soumis", essais: 1, relances: 2, derniereProgression: 5, progresDepuis: "p" });
  });

  it("ne mute pas l'entrée", () => {
    const t = suivi({ injoignableDepuis: 9, memeId: true });
    const avant = structuredClone(t);
    sansReprise(t);
    expect(t).toEqual(avant);
  });
});

describe("suiviSansEssai", () => {
  it("réponse qui n'est pas un échec : null (traitement ordinaire)", () => {
    expect(suiviSansEssai(suivi(), { statut: "en_file" }, MAINTENANT)).toBeNull();
    expect(suiviSansEssai(suivi(), { statut: "en_cours", progression: 3 }, MAINTENANT)).toBeNull();
  });

  it("injoignable pour la première fois : démarre le compteur à maintenant, aucun essai consommé", () => {
    const t = suivi();
    expect(suiviSansEssai(t, echecFacecam({ injoignable: true }), MAINTENANT)).toEqual({ id: "t-1", statut: "soumis", essais: 1, injoignableDepuis: MAINTENANT });
  });

  it("injoignable déjà depuis un moment (< 30 min) : garde la date de début", () => {
    const debut = MAINTENANT - (ATTENTE_INJOIGNABLE_MS - 1);
    expect(suiviSansEssai(suivi({ injoignableDepuis: debut }), echecFacecam({ injoignable: true }), MAINTENANT)).toEqual({ id: "t-1", statut: "soumis", essais: 1, injoignableDepuis: debut });
  });

  it("injoignable depuis 30 min pile : null (l'échec ordinaire reprend la main)", () => {
    expect(suiviSansEssai(suivi({ injoignableDepuis: MAINTENANT - ATTENTE_INJOIGNABLE_MS }), echecFacecam({ injoignable: true }), MAINTENANT)).toBeNull();
  });

  it("travail inconnu : resoumis sous le même id, relances +1, essais inchangés", () => {
    const r = suiviSansEssai(suivi({ injoignableDepuis: 4, essais: 2 }), echecFacecam({ code: "inconnu", message: "404", travailInconnu: true, reessayable: false }), MAINTENANT);
    expect(r).toEqual({ id: "t-1", statut: "echec", essais: 2, erreur: { code: "inconnu", message: "404", reessayable: true }, memeId: true, relances: 1 });
  });

  it("travail inconnu : incrémente à partir des relances existantes", () => {
    const r = suiviSansEssai(suivi({ relances: 2 }), echecFacecam({ travailInconnu: true }), MAINTENANT);
    expect(r?.relances).toBe(3);
  });

  it("travail inconnu : au maximum de relances, null", () => {
    expect(RELANCES_MEME_ID_MAX).toBe(3);
    expect(suiviSansEssai(suivi({ relances: RELANCES_MEME_ID_MAX }), echecFacecam({ travailInconnu: true }), MAINTENANT)).toBeNull();
  });

  it("échec ordinaire : null", () => {
    expect(suiviSansEssai(suivi(), echecFacecam(), MAINTENANT)).toBeNull();
  });

  it("l'injoignable l'emporte sur travailInconnu quand les deux sont posés", () => {
    const r = suiviSansEssai(suivi(), echecFacecam({ injoignable: true, travailInconnu: true }), MAINTENANT);
    expect(r).toEqual({ id: "t-1", statut: "soumis", essais: 1, injoignableDepuis: MAINTENANT });
  });

  it("ne mute pas l'entrée", () => {
    const t = suivi({ injoignableDepuis: 4, relances: 1 });
    const avant = structuredClone(t);
    suiviSansEssai(t, echecFacecam({ injoignable: true }), MAINTENANT);
    suiviSansEssai(t, echecFacecam({ travailInconnu: true }), MAINTENANT);
    expect(t).toEqual(avant);
  });
});

describe("prochaineSoumission", () => {
  it("aucun précédent : essais 0, id demandé pour l'essai 0", () => {
    const nouvelId = vi.fn((n: number) => `id-${n}`);
    expect(prochaineSoumission(undefined, nouvelId)).toEqual({ id: "id-0", essais: 0 });
    expect(nouvelId).toHaveBeenCalledTimes(1);
    expect(nouvelId).toHaveBeenCalledWith(0);
  });

  it("précédent présent : un essai de plus, id demandé pour ce nouvel essai", () => {
    const nouvelId = vi.fn((n: number) => `id-${n}`);
    expect(prochaineSoumission(suivi({ essais: 1 }), nouvelId)).toEqual({ id: "id-2", essais: 2 });
    expect(nouvelId).toHaveBeenCalledTimes(1);
    expect(nouvelId).toHaveBeenCalledWith(2);
  });

  it("précédent avec memeId : même id, mêmes essais, relances reprises si > 0, id jamais redemandé", () => {
    const nouvelId = vi.fn(() => "jamais");
    expect(prochaineSoumission(suivi({ id: "ancien", essais: 2, memeId: true, relances: 2 }), nouvelId)).toEqual({ id: "ancien", essais: 2, relances: 2 });
    expect(nouvelId).not.toHaveBeenCalled();
  });

  it("memeId sans relances : pas de clé relances", () => {
    const r = prochaineSoumission(suivi({ id: "ancien", essais: 2, memeId: true }), () => "jamais");
    expect(r).toEqual({ id: "ancien", essais: 2 });
    expect("relances" in r).toBe(false);
  });

  it("memeId avec relances 0 : pas de clé relances", () => {
    expect("relances" in prochaineSoumission(suivi({ memeId: true, relances: 0 }), () => "x")).toBe(false);
  });

  it("ne mute pas le précédent", () => {
    const p = suivi({ memeId: true, relances: 1 });
    const avant = structuredClone(p);
    prochaineSoumission(p, () => "x");
    prochaineSoumission(suivi(), () => "x");
    expect(p).toEqual(avant);
  });
});

describe("apresSoumission", () => {
  const s = { id: "t-2", essais: 1 };

  it("soumission acceptée (en_file) : soumis, progression 0", () => {
    expect(apresSoumission(s, undefined, { statut: "en_file" }, MAINTENANT)).toEqual({ id: "t-2", essais: 1, statut: "soumis", progression: 0 });
  });

  it("soumission acceptée (en_cours) : soumis, progression 0 (la progression lue n'est pas reprise)", () => {
    expect(apresSoumission({ ...s, relances: 2 }, undefined, { statut: "en_cours", progression: 50 }, MAINTENANT)).toEqual({ id: "t-2", essais: 1, relances: 2, statut: "soumis", progression: 0 });
  });

  it("injoignable, sans précédent : échec réessayable, memeId, injoignableDepuis = maintenant", () => {
    expect(apresSoumission(s, undefined, echecFacecam({ injoignable: true, message: "muet" }), MAINTENANT)).toEqual({
      id: "t-2", essais: 1, statut: "echec", erreur: { code: "indisponible", message: "muet", reessayable: true }, memeId: true, injoignableDepuis: MAINTENANT,
    });
  });

  it("injoignable avec précédent memeId : garde la date de début du précédent", () => {
    const debut = MAINTENANT - 60_000;
    const r = apresSoumission(s, suivi({ memeId: true, injoignableDepuis: debut }), echecFacecam({ injoignable: true }), MAINTENANT);
    expect(r.injoignableDepuis).toBe(debut);
    expect(r.memeId).toBe(true);
  });

  it("injoignable avec précédent SANS memeId : la date du précédent est ignorée (repart de maintenant)", () => {
    const r = apresSoumission(s, suivi({ injoignableDepuis: MAINTENANT - 60_000 }), echecFacecam({ injoignable: true }), MAINTENANT);
    expect(r.injoignableDepuis).toBe(MAINTENANT);
  });

  it("injoignable depuis 30 min pile : échec ordinaire, avec la réessayabilité du fournisseur, sans memeId", () => {
    const precedent = suivi({ memeId: true, injoignableDepuis: MAINTENANT - ATTENTE_INJOIGNABLE_MS });
    const r = apresSoumission(s, precedent, echecFacecam({ injoignable: true, reessayable: false, message: "toujours muet" }), MAINTENANT);
    expect(r).toEqual({ id: "t-2", essais: 1, statut: "echec", erreur: { code: "indisponible", message: "toujours muet", reessayable: false } });
    expect("memeId" in r).toBe(false);
    expect("injoignableDepuis" in r).toBe(false);
  });

  it("échec ordinaire : recopie code, message et réessayabilité", () => {
    expect(apresSoumission(s, undefined, echecFacecam({ code: "refuse", message: "non", reessayable: false }), MAINTENANT)).toEqual({
      id: "t-2", essais: 1, statut: "echec", erreur: { code: "refuse", message: "non", reessayable: false },
    });
  });

  it("ne mute ni le précédent ni les infos de soumission", () => {
    const p = suivi({ memeId: true, injoignableDepuis: 3 });
    const sj = { id: "t-2", essais: 1, relances: 1 };
    const avantP = structuredClone(p);
    const avantS = structuredClone(sj);
    apresSoumission(sj, p, echecFacecam({ injoignable: true }), MAINTENANT);
    expect(p).toEqual(avantP);
    expect(sj).toEqual(avantS);
  });
});

describe("lireCarteGardee", () => {
  const demande: DemandeRendu = { idRendu: "r-1", operation: "montage" as DemandeRendu["operation"], file: "courte", entrees: {}, sortie: { urlDepot: "https://exemple.invalide/depot", cle: "k" }, parametres: {} };

  function faux(etats: EtatRendu[]) {
    const etat = vi.fn(async () => etats.shift() as EtatRendu);
    const soumettre = vi.fn(async (d: DemandeRendu) => ({ idRendu: d.idRendu }));
    const service: ServiceRendu = { etat, soumettre };
    return { service, etat, soumettre };
  }

  it("sans garde : lecture nue, état rendu tel quel, la carte n'est pas touchée", async () => {
    const { service, etat, soumettre } = faux([{ statut: "en_cours", progression: 12 }]);
    const carte = { demande };
    expect(await lireCarteGardee(service, carte, undefined)).toEqual({ statut: "en_cours", progression: 12 });
    expect(etat).toHaveBeenCalledTimes(1);
    expect(etat).toHaveBeenCalledWith("r-1");
    expect(soumettre).not.toHaveBeenCalled();
    expect(carte).toEqual({ demande });
  });

  it("sans garde : un rendu inconnu est resoumis (suivreRendu) et rendu « en_file » resoumis", async () => {
    const { service, soumettre } = faux([{ statut: "inconnu" }]);
    expect(await lireCarteGardee(service, { demande }, undefined)).toEqual({ statut: "en_file", rang: 0, resoumis: true });
    expect(soumettre).toHaveBeenCalledTimes(1);
    expect(soumettre).toHaveBeenCalledWith(demande);
  });

  it("avec garde : la veille est posée sur la carte (signature + horloge de la garde)", async () => {
    const { service, soumettre } = faux([{ statut: "en_cours", progression: 30 }]);
    const carte: { demande: DemandeRendu; veille?: { signature: string; depuis: number } } = { demande };
    const r = await lireCarteGardee(service, carte, { delaiMs: 600_000, maintenant: () => MAINTENANT });
    expect(r).toEqual({ statut: "en_cours", progression: 30 });
    expect(carte.veille).toEqual({ signature: "en_cours:30", depuis: MAINTENANT });
    expect(soumettre).not.toHaveBeenCalled();
  });

  it("avec garde : la progression n'a pas bougé mais le délai n'est pas atteint → veille inchangée", async () => {
    const { service } = faux([{ statut: "en_cours", progression: 30 }]);
    const veille = { signature: "en_cours:30", depuis: MAINTENANT - 60_000 };
    const carte = { demande, veille };
    const r = await lireCarteGardee(service, carte, { delaiMs: 600_000, maintenant: () => MAINTENANT });
    expect(r).toEqual({ statut: "en_cours", progression: 30 });
    expect(carte.veille).toEqual({ signature: "en_cours:30", depuis: MAINTENANT - 60_000 });
  });

  it("avec garde : le rendu figé au-delà du délai devient un échec réessayable ; la veille est conservée", async () => {
    const { service } = faux([{ statut: "en_cours", progression: 30 }]);
    const veille = { signature: "en_cours:30", depuis: MAINTENANT - 600_000 };
    const carte = { demande, veille };
    const r = await lireCarteGardee(service, carte, { delaiMs: 600_000, maintenant: () => MAINTENANT });
    expect(r).toEqual({ statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "Rendu sans nouvelle depuis 10 min." } });
    // lireRenduGarde ne rend pas de veille sur un échec de garde : la carte perd la sienne.
    expect("veille" in carte).toBe(false);
  });

  it("avec garde : rendu inconnu → échec réessayable, veille retirée de la carte, rien n'est resoumis", async () => {
    const { service, soumettre } = faux([{ statut: "inconnu" }]);
    const carte = { demande, veille: { signature: "en_cours:1", depuis: MAINTENANT - 5 * 60_000 } };
    const r = await lireCarteGardee(service, carte, { delaiMs: 600_000, maintenant: () => MAINTENANT });
    expect(r).toEqual({ statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "Rendu sans nouvelle depuis 5 min : le serveur de rendu ne le connaît plus." } });
    expect("veille" in carte).toBe(false);
    expect(soumettre).not.toHaveBeenCalled();
  });

  it("avec garde : la progression a changé → nouvelle veille à maintenant", async () => {
    const { service } = faux([{ statut: "en_cours", progression: 31 }]);
    const carte = { demande, veille: { signature: "en_cours:30", depuis: MAINTENANT - 900_000 } };
    const r = await lireCarteGardee(service, carte, { delaiMs: 600_000, maintenant: () => MAINTENANT });
    expect(r).toEqual({ statut: "en_cours", progression: 31 });
    expect(carte.veille).toEqual({ signature: "en_cours:31", depuis: MAINTENANT });
  });
});
