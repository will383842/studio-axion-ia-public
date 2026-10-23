/**
 * X12 · « Reprendre cette étape » après un arrêt de l'écriture (vidéo `v-3a71b4a4dfea`, travail `trav-567a8ba76ac5`).
 *
 * Avant X12, « Réessayer » rejouait les DEUX réponses déjà refusées : même refus, même phrase, aucun effet visible ; et
 * un journal écrit par une version antérieure du code (consigne différente, donc autre empreinte d'appel) relançait deux
 * appels payés en silence. Attendu : les réponses déjà payées sont relues avec les règles du jour (X9 complète `valeur`),
 * puis, seulement si elles restent refusées, UN nouvel appel, annoncé avec son prix dans la phrase de l'arrêt.
 *
 * Doubles seulement : appels détachés gardés en mémoire, aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { MoteurVideo } from "@/moteurs/types";
import type { AppelsDetaches, ReponseAppelEcriture } from "@/moteurs/montage-cas-concret/outils";
import { NOTE_REPONSE_REPRISE } from "@/moteurs/montage-cas-concret/ecriture";
import { banc, type Banc } from "../moteur/doubles";

const T0 = Date.UTC(2026, 9, 13, 16, 0, 0);
const ctx = (travailId: string) => ({ travailId, versionId: `ver-${travailId}`, titre: "Essai", maintenant: T0 });

type Brut = Record<string, unknown> & { ecrans: Record<string, unknown>[] };
type Mode = "juste" | "sansValeur" | "sansFait" | "vide";

/** Le défaut du vrai Claude (X9) : pas de `valeur` sur les écrans à chiffre ; `sansFait` : pas de `faitId` non plus. */
function abimer(texte: string, mode: Mode): string {
  if (mode === "juste") return texte;
  if (mode === "vide") return "";
  const b = JSON.parse(texte) as Brut;
  for (const e of b.ecrans) {
    if (e.type === "chiffre") {
      delete e.valeur;
      if (mode === "sansFait") delete e.faitId;
    }
    if (e.type === "resultat") {
      for (const cote of ["avant", "maintenant"]) {
        const barre = e[cote] as Record<string, unknown>;
        if (barre.faitId === undefined) continue;
        delete barre.valeur;
        if (mode === "sansFait") delete barre.faitId;
      }
    }
  }
  return JSON.stringify(b);
}

/**
 * Écriture détachée en mémoire : chaque appel rend la réponse simulée abîmée selon `modes` (un par appel d'écriture).
 * `gardees` : les réponses gardées (comme les paramètres du studio), `ecritures` : le nombre d'appels d'écriture PAYÉS.
 */
function ecritureDetacheeEnMemoire(b: Banc, modes: Mode[]) {
  const o = b.d.options.outils;
  const gardees = new Map<string, ReponseAppelEcriture>();
  const lancees: string[] = [];
  /** Réponse juste de chaque appel, avant le défaut (la fiche simulée de CE travail). */
  const justes: string[] = [];
  const origine = o.ecriture.appeler;
  let n = 0;
  const detache: AppelsDetaches = {
    lancer: async (cle, appel) => {
      lancees.push(cle);
      gardees.set(cle, await appel());
    },
    lire: async (cle) => gardees.get(cle) ?? null,
  };
  o.ecriture = {
    ...o.ecriture,
    detache,
    appeler: async (role, entree) => {
      const r = await origine(role, entree);
      if (role.id !== "ecriture-cas-concret" || !r.ok) return r;
      const mode = modes[n++] ?? "juste";
      const texte = typeof r.texte === "string" ? r.texte : "";
      justes.push(texte);
      return { ...r, simule: false, coutUsd: 0.12, texte: abimer(texte, mode) };
    },
  };
  return { gardees, lancees, justes, ecritures: () => n };
}

async function avancerJusqua(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail, depuis = T0) {
  let t = depart;
  for (let i = 0; i < 400; i++) {
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, depuis + i * 1000);
    t = r.travail;
    if (t.statut === "termine" || t.statut === "echec") return { travail: t, maintenant: depuis + i * 1000 };
  }
  throw new Error(`Fabrication figée : ${t.etapes.map((e) => `${e.cle}:${e.statut}`).join(" ")}`);
}

const journalDe = (t: Travail) => (t.parametres?.casConcret as { journal: { appels?: Record<string, { empreinte: string; tentative: number }>; etapes: Record<string, { sortie?: { notes?: string[] } } | undefined> } }).journal;

async function arretALEcriture(b: Banc, modes: Mode[], id: string) {
  const e = ecritureDetacheeEnMemoire(b, modes);
  const c = b.commande();
  const arret = await avancerJusqua(b.moteur, c, await b.moteur.lancer(c, ctx(id)));
  expect(arret.travail.statut).toBe("echec");
  expect(arret.travail.etapes.filter((x) => x.statut === "echec").map((x) => x.cle)).toEqual(["ecriture"]);
  return { ...e, c, arret };
}

describe("X12 · l'écriture refusée deux fois", () => {
  it("la phrase d'arrêt annonce ce que fait « Réessayer » et le prix d'un nouvel essai", async () => {
    const b = banc();
    const { arret, ecritures } = await arretALEcriture(b, ["sansFait", "sansFait"], "t-x12-a");
    expect(ecritures()).toBe(2);
    const phrase = arret.travail.erreur?.messagePourWill ?? "";
    expect(phrase).toContain("L'étape « L'écriture » n'a pas abouti.");
    expect(phrase).toContain("Vous pouvez réessayer cette étape seule.");
    expect(phrase).toMatch(/« Reprendre » relit d'abord les réponses déjà payées avec les règles du jour ; si elles restent refusées, un nouvel essai d'écriture coûte environ \d+,\d\d\s€\./);
    expect(arret.travail.erreur?.reessayable).toBe(true);
  });

  it("« Réessayer » : les réponses gardées restent refusées → UN seul nouvel appel, qui passe ; la vidéo se termine", async () => {
    const b = banc();
    const { c, arret, ecritures, lancees } = await arretALEcriture(b, ["sansFait", "sansFait", "juste"], "t-x12-b");
    const relance = await b.moteur.reessayer(arret.travail, arret.maintenant);
    expect(relance.statut).toBe("en_cours");
    expect(relance.etapes.find((e) => e.cle === "ecriture")?.statut).toBe("en_attente");
    const fin = await avancerJusqua(b.moteur, c, relance, arret.maintenant);
    expect(fin.travail.statut).toBe("termine");
    expect(ecritures()).toBe(3);
    // Le nouvel appel a son propre identifiant ; les deux premiers ne sont jamais relancés.
    expect(lancees.map((l) => l.replace(/\.[0-9a-f]{12}\./, ".").replace(/^ccecr-[^-]+-[^-]+-/, "")).filter(Boolean)).toHaveLength(3);
    expect(lancees.filter((l) => /-r1\./.test(l))).toHaveLength(1);
  });

  it("le nouvel essai est encore refusé : nouvel arrêt, phrase différente ; chaque « Réessayer » fait au plus UN appel", async () => {
    const b = banc();
    const { c, arret, ecritures } = await arretALEcriture(b, ["vide", "vide", "vide", "vide"], "t-x12-c");
    const premiere = arret.travail.erreur?.messagePourWill;
    const r1 = await avancerJusqua(b.moteur, c, await b.moteur.reessayer(arret.travail, arret.maintenant), arret.maintenant);
    expect(r1.travail.statut).toBe("echec");
    expect(ecritures()).toBe(3);
    expect(r1.travail.erreur?.messagePourWill).toContain("Fiche d'écrans refusée au nouvel essai");
    expect(r1.travail.erreur?.messagePourWill).not.toBe(premiere);
    expect(r1.travail.tentatives).toBe(2);
    const r2 = await avancerJusqua(b.moteur, c, await b.moteur.reessayer(r1.travail, r1.maintenant), r1.maintenant);
    expect(r2.travail.statut).toBe("echec");
    expect(ecritures()).toBe(4);
  });

  it("une réponse gardée qui passe avec les règles du jour est reprise : aucun appel de plus", async () => {
    const b = banc();
    const { c, arret, ecritures, gardees, justes } = await arretALEcriture(b, ["sansFait", "sansFait"], "t-x12-d");
    // Les règles du jour acceptent la réponse gardée du premier appel (sans `valeur`, avec `faitId` : X9 pose la valeur).
    const j = journalDe(arret.travail);
    const id1 = Object.keys(j.appels ?? {}).find((k) => k.endsWith("-1"))!;
    const s1 = j.appels![id1];
    const cle = `${id1}.${s1.empreinte.slice(0, 12)}.${s1.tentative}`;
    gardees.set(cle, { ...(gardees.get(cle) as Extract<ReponseAppelEcriture, { ok: true }>), texte: abimer(justes[0], "sansValeur") });
    const fin = await avancerJusqua(b.moteur, c, await b.moteur.reessayer(arret.travail, arret.maintenant), arret.maintenant);
    expect(fin.travail.statut).toBe("termine");
    expect(ecritures()).toBe(2);
    expect(journalDe(fin.travail).etapes.ecriture?.sortie?.notes ?? []).toContain(NOTE_REPONSE_REPRISE);
  });
});

describe("X12 · cas réel : travail en échec créé AVANT la mise en ligne (journal d'ancienne forme)", () => {
  /** Réécrit le journal comme l'ancien code l'avait laissé : autre empreinte d'appel (autre consigne). */
  function vieillir(t: Travail, gardees: Map<string, ReponseAppelEcriture>, retoucher: (texte: string) => string): Travail {
    const copie = JSON.parse(JSON.stringify(t)) as Travail;
    const j = journalDe(copie);
    for (const [id, s] of Object.entries(j.appels ?? {})) {
      const ancienne = `ancienneconsigne${s.empreinte}`;
      for (let n = 1; n <= s.tentative; n++) {
        const r = gardees.get(`${id}.${s.empreinte.slice(0, 12)}.${n}`);
        if (r) gardees.set(`${id}.${ancienne.slice(0, 12)}.${n}`, r.ok ? { ...r, texte: retoucher(typeof r.texte === "string" ? r.texte : "") } : r);
      }
      s.empreinte = ancienne;
    }
    return copie;
  }

  it("réponses gardées sans `valeur` (avec `faitId`) : reprises avec le code du jour, aucun nouvel appel", async () => {
    const b = banc();
    const { c, arret, ecritures, gardees, justes } = await arretALEcriture(b, ["sansFait", "sansFait"], "t-x12-e");
    // L'ancienne écriture avait rendu des écrans à chiffre sans `valeur`, avec leur `faitId` (refusés avant X9).
    const ancien = vieillir(arret.travail, gardees, () => abimer(justes[0], "sansValeur"));
    const fin = await avancerJusqua(b.moteur, c, await b.moteur.reessayer(ancien, arret.maintenant), arret.maintenant);
    expect(fin.travail.statut).toBe("termine");
    expect(ecritures()).toBe(2);
    expect(journalDe(fin.travail).etapes.ecriture?.sortie?.notes ?? []).toContain(NOTE_REPONSE_REPRISE);
  });

  it("réponses gardées sans `valeur` ni `faitId` : UN appel avec la consigne du jour, puis la vidéo se termine", async () => {
    const b = banc();
    const { c, arret, ecritures, gardees, lancees } = await arretALEcriture(b, ["sansFait", "sansFait", "juste"], "t-x12-f");
    const ancien = vieillir(arret.travail, gardees, (texte) => texte);
    const avant = lancees.length;
    const fin = await avancerJusqua(b.moteur, c, await b.moteur.reessayer(ancien, arret.maintenant), arret.maintenant);
    expect(fin.travail.statut).toBe("termine");
    expect(ecritures()).toBe(3);
    expect(lancees.slice(avant)).toHaveLength(1);
    expect(lancees.at(-1)).toMatch(/-r1\./);
  });
});
