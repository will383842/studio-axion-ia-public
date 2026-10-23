/**
 * X10 · un rendu raté ne fige jamais la fabrication (incident du tableau animé du 12/10, reproduit chez nous).
 *
 * Notre format sort un fichier par suite de fins (jusqu'à trois). Chaque cas : un rendu ou une voix rate APRÈS que
 * d'autres sorties ont réussi. Attendu : l'étape passe en échec avec une phrase lisible, rien ne reste « en cours » sans
 * fin, et « Réessayer » ne refait QUE ce qui a raté (jamais le corps, jamais une voix payée, jamais un écran ou une fin
 * déjà faits). Règle : un échec, où qu'il soit, l'emporte toujours sur « déjà fait ».
 *
 * Doubles seulement (aucun appel réel) ; le serveur de rendu imite `studio-rendu` : une demande ratée, soumise de
 * nouveau sous le même identifiant, repart.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs/types";
import { MESURES_CONFORMES } from "../fabriquer/doubles";
import { banc, type Banc } from "./doubles";

const T0 = Date.UTC(2026, 9, 12, 9, 0, 0);
const ctx = (travailId: string) => ({ travailId, versionId: `ver-${travailId}`, titre: "Essai", maintenant: T0 });
const estEcran = (d: DemandeRendu) => d.operation === "composition" && (d.parametres as { mode?: string }).mode === undefined;
const estComplet = (d: DemandeRendu) => d.operation === "composition" && (d.parametres as { mode?: string }).mode === "complet";
const sansEssai = (id: string) => id.replace(/-e\d+$/, "");

const TARGET_CLOSED: EtatRendu = { statut: "echec", erreur: { code: "inconnu", reessayable: true, message: "Protocol error (Page.bringToFront): Target closed. https://www.remotion.dev/docs/target-closed" } };

/** Avance tour après tour (aller-retour JSON, comme en base) jusqu'à « termine » ou « echec ». */
async function avancerJusqua(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail, depuis = T0) {
  let t = depart;
  let resultat: ResultatFabrication | undefined;
  for (let n = 0; n < 300; n++) {
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, depuis + n * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (t.statut === "termine" || t.statut === "echec") return { travail: t, resultat, maintenant: depuis + n * 1000 };
  }
  throw new Error(`Fabrication figée : statut « ${t.statut} », étapes ${t.etapes.map((e) => `${e.cle}:${e.statut}`).join(" ")}.`);
}

/** Serveur de rendu pilotable posé sur celui des doubles : `rater(d)` donne l'état gardé pour une demande. */
function serveur(b: Banc) {
  const base = b.d.options.outils.scenes.rendu();
  const forces = new Map<string, EtatRendu>();
  const soumises: DemandeRendu[] = [];
  const panne: { rater: (d: DemandeRendu) => EtatRendu | null } = { rater: () => null };
  const service: ServiceRendu = {
    async soumettre(d) {
      soumises.push(d);
      const e = panne.rater(d);
      if (e) {
        forces.set(d.idRendu, e);
        return { idRendu: d.idRendu };
      }
      forces.delete(d.idRendu);
      return base.soumettre(d);
    },
    async etat(id) {
      return forces.get(id) ?? base.etat(id);
    },
  };
  const o = b.d.options.outils;
  o.scenes = { ...o.scenes, rendu: () => service };
  o.montage = { ...o.montage, rendu: () => service };
  return { panne, soumises, ecrans: () => soumises.filter(estEcran).map((x) => x.idRendu), compositions: () => soumises.filter(estComplet).map((x) => x.idRendu) };
}

/** Une vidéo sans panne (mêmes entrées : mêmes identifiants de rendu), pour désigner ce qui ratera. */
async function temoin() {
  const b = banc();
  const s = serveur(b);
  const c = b.commande();
  const fin = await avancerJusqua(b.moteur, c, await b.moteur.lancer(c, ctx("t-temoin")));
  expect(fin.travail.statut).toBe("termine");
  return { ecrans: s.ecrans(), compositions: s.compositions(), assemblages: b.d.assemblages.map((a) => a.id) };
}

/** Échec clair : une seule étape en échec (celle attendue), aucune « en cours », phrase lisible (rien de technique). */
function echecClair(t: Travail, cle: string, motif: RegExp = /n'a pas abouti/) {
  expect(t.statut).toBe("echec");
  expect(t.etapes.filter((e) => e.statut === "echec").map((e) => e.cle)).toEqual([cle]);
  expect(t.etapes.filter((e) => e.statut === "en_cours")).toEqual([]);
  const phrase = t.erreur?.messagePourWill ?? "";
  expect(phrase).toMatch(motif);
  expect(phrase).not.toMatch(/Target closed|https?:|remotion|\b[0-9a-f]{12,}\b|\bcc-|\bfin-|\be\d\d\b|\bf\d\d\b/i);
}

const terminees = (t: Travail) => t.etapes.filter((e) => e.statut === "terminee").map((e) => e.cle);

describe("X10 · (a) un écran d'une autre suite de fins rate après que la première est faite", () => {
  it("échec lisible sur « Les écrans » ; « Réessayer » ne rend que l'écran raté, rien n'est repayé", async () => {
    const ref = await temoin();
    // Le dernier écran rendu : celui de la dernière suite de fins (les écrans du corps et des autres fins sont faits).
    const cible = ref.ecrans.at(-1)!;
    const b = banc();
    const s = serveur(b);
    s.panne.rater = (d) => (sansEssai(d.idRendu) === cible ? TARGET_CLOSED : null);
    const c = b.commande();
    const enEchec = await avancerJusqua(b.moteur, c, await b.moteur.lancer(c, ctx("t-x10-a")));
    echecClair(enEchec.travail, "ecrans");
    expect(enEchec.travail.erreur?.reessayable).toBe(true);
    expect(enEchec.travail.erreur?.messagePourWill).toMatch(/écran de la fin pour/);
    // Le même écran a été soumis deux fois (un nouvel essai sous un autre identifiant), puis l'échec.
    expect(s.ecrans().filter((id) => sansEssai(id) === cible)).toEqual([cible, `${cible}-e1`]);
    expect(terminees(enEchec.travail)).toEqual(["ecriture", "fiche", "captures", "voix", "calage"]);

    const lus = b.d.lus.length;
    const ecrans = s.ecrans().length;
    s.panne.rater = () => null;
    const fin = await avancerJusqua(b.moteur, c, await b.moteur.reessayer(enEchec.travail, enEchec.maintenant), enEchec.maintenant);
    expect(fin.travail.statut).toBe("termine");
    expect(b.d.lus).toHaveLength(lus);
    // Seul l'écran raté repart ; les autres (corps et autres fins) ne sont jamais rendus de nouveau.
    expect(s.ecrans().slice(ecrans)).toEqual([`${cible}-r1`]);
    expect(s.compositions()).toHaveLength(3);
  });
});

describe("X10 · (b) l'assemblage de la deuxième sortie rate", () => {
  it("le raccord de voix de la deuxième fin : échec lisible sur « La voix » ; la reprise ne refait que lui", async () => {
    const ref = await temoin();
    const cible = ref.assemblages[1];
    const b = banc();
    const v = b.d.options.outils.voix;
    const assembler = v.assembler;
    const panne = { active: true };
    const appels: string[] = [];
    v.assembler = async (a) => {
      appels.push(a.id);
      if (panne.active && a.id === cible) throw Object.assign(new Error("Rendu cc-recette : Target closed (https://www.remotion.dev)"), { erreur: { code: "inconnu", reessayable: false, message: "Target closed" } });
      return assembler(a);
    };
    const c = b.commande();
    const enEchec = await avancerJusqua(b.moteur, c, await b.moteur.lancer(c, ctx("t-x10-b1")));
    echecClair(enEchec.travail, "voix");
    expect(enEchec.travail.erreur?.reessayable).toBe(true);
    const lus = [...b.d.lus];
    expect(lus).toHaveLength(4);
    const avant = appels.length;
    panne.active = false;
    const fin = await avancerJusqua(b.moteur, c, await b.moteur.reessayer(enEchec.travail, enEchec.maintenant), enEchec.maintenant);
    expect(fin.travail.statut).toBe("termine");
    // Aucune voix relue ; le raccord de la première fin, déjà fait, n'est pas refait.
    expect(b.d.lus).toEqual(lus);
    expect(appels.slice(avant)).toEqual([cible, ...ref.assemblages.slice(2)]);
  });

  it("la composition de la deuxième sortie : échec lisible sur « Les finitions » ; la reprise ne compose qu'elle et la suivante", async () => {
    const ref = await temoin();
    const cible = sansEssai(ref.compositions[1]);
    const b = banc();
    const s = serveur(b);
    s.panne.rater = (d) => (sansEssai(d.idRendu) === cible ? { ...TARGET_CLOSED, erreur: { ...(TARGET_CLOSED as Extract<EtatRendu, { statut: "echec" }>).erreur, reessayable: false } } : null);
    const c = b.commande();
    const enEchec = await avancerJusqua(b.moteur, c, await b.moteur.lancer(c, ctx("t-x10-b2")));
    echecClair(enEchec.travail, "montage");
    expect(enEchec.travail.erreur?.reessayable).toBe(true);
    expect(enEchec.travail.erreur?.messagePourWill).toMatch(/fin pour/);
    expect(s.compositions()).toEqual(ref.compositions.slice(0, 2));
    const lus = b.d.lus.length;
    const ecrans = s.ecrans().length;
    s.panne.rater = () => null;
    const fin = await avancerJusqua(b.moteur, c, await b.moteur.reessayer(enEchec.travail, enEchec.maintenant), enEchec.maintenant);
    expect(fin.travail.statut).toBe("termine");
    expect(b.d.lus).toHaveLength(lus);
    expect(s.ecrans()).toHaveLength(ecrans);
    // La première fin, faite, n'est jamais recomposée ; la ratée repart, puis la troisième.
    expect(s.compositions().slice(2)).toEqual([`${cible}-e1`, ref.compositions[2]]);
  });
});

describe("X10 · (c) la voix d'une fin est refusée après que le corps est accepté", () => {
  it("échec lisible sur « La voix » ; la reprise ne relit que les fins restantes, jamais le corps", async () => {
    const b = banc();
    const v = b.d.options.outils.voix;
    const fournisseur = v.voix();
    const panne = { active: true };
    let lectures = 0;
    v.voix = () => ({
      ...fournisseur,
      async lire(d) {
        // La deuxième lecture (la première fin) est refusée par le fournisseur, sans être payée.
        if (panne.active && ++lectures === 2) throw Object.assign(new Error("La voix n'a pas pu être lue."), { reessayable: true });
        return fournisseur.lire(d);
      },
    });
    const c = b.commande();
    const enEchec = await avancerJusqua(b.moteur, c, await b.moteur.lancer(c, ctx("t-x10-c")));
    echecClair(enEchec.travail, "voix");
    expect(enEchec.travail.erreur?.reessayable).toBe(true);
    const corps = b.d.lus[0];
    expect(b.d.lus).toHaveLength(1);
    const paye = b.moteur.lignesPayees?.(enEchec.travail, c);
    panne.active = false;
    const fin = await avancerJusqua(b.moteur, c, await b.moteur.reessayer(enEchec.travail, enEchec.maintenant), enEchec.maintenant);
    expect(fin.travail.statut).toBe("termine");
    expect(b.d.lus.filter((t) => t === corps)).toHaveLength(1);
    expect(b.d.lus).toHaveLength(4);
    expect(paye?.[0].total.centimes).toBeGreaterThan(0);
  });
});

describe("X10 · (d) le contrôle final d'une sortie échoue, les autres passent", () => {
  it("« La vérification » en échec avec la phrase du contrôle ; toutes les autres étapes faites ; rien en cours", async () => {
    const ref = await temoin();
    const cible = sansEssai(ref.compositions[1]);
    const b = banc();
    const s = serveur(b);
    s.panne.rater = (d) => (sansEssai(d.idRendu) === cible ? { statut: "termine", sortieCle: d.sortie.cle, mesures: { ...MESURES_CONFORMES, largeur: 720, dureeSec: (d.parametres as { dureeSec: number }).dureeSec } } : null);
    const c = b.commande();
    const fin = await avancerJusqua(b.moteur, c, await b.moteur.lancer(c, ctx("t-x10-d")));
    echecClair(fin.travail, "controle", /La vérification bloque la livraison/);
    expect(terminees(fin.travail)).toEqual(["ecriture", "fiche", "captures", "voix", "calage", "ecrans", "montage"]);
    expect(fin.travail.erreur?.messagePourWill).toMatch(/720 sur 1920/);
    expect(fin.resultat).toBeUndefined();
  });
});

describe("X10 · un échec l'emporte toujours sur « déjà fait »", () => {
  it("une étape déjà passée qui doit être refaite puis rate : elle est montrée en échec, le travail ne reste pas « en cours »", async () => {
    const b = banc();
    const c = b.commande();
    // Jusqu'aux écrans : la voix est déjà faite pour ce travail.
    let t = await b.moteur.lancer(c, ctx("t-x10-ordre"));
    let n = 0;
    for (; n < 100 && t.etapes.find((e) => e.cle === "ecrans")?.statut !== "en_cours"; n++) t = (await b.moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, c, T0 + n * 1000)).travail;
    expect(terminees(t)).toContain("voix");
    // Les réglages de la voix changent : la voix est à refaire, et son fournisseur refuse maintenant de lire.
    const v = b.d.options.outils.voix;
    v.reglages = { ...v.reglages!, stabilite: 60 };
    const fournisseur = v.voix();
    v.voix = () => ({
      ...fournisseur,
      async lire() {
        throw Object.assign(new Error("La voix n'a pas pu être lue."), { reessayable: true });
      },
    });
    const fin = await avancerJusqua(b.moteur, c, t, T0 + n * 1000);
    echecClair(fin.travail, "voix");
  });
});
