/**
 * X9 · « champ valeur obligatoire absent » (premier essai réel, vidéo `v-3a71b4a4dfea`, cas `recrutement-apporteurs`,
 * 4 réseaux, sans le mot) : Claude rendait une fiche bien formée SAUF le nombre `valeur` des écrans à chiffre, deux fois.
 * Claude désigne le fait (`faitId`), le code pose sa valeur (`completerFiche`). Doubles seulement : aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins/table-diagnostic";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { ReseauCas } from "@/formats/cas-concret";
import type { CasConcret } from "@/formats/cas-concret/cas";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { creerMoteurMontageCasConcret } from "@/moteurs/montage-cas-concret";
import { CLASSEMENT_CHAMPS, completerFiche } from "@/moteurs/montage-cas-concret/champs-du-cas";
import {
  CONSIGNE_ECRITURE,
  DUREE_SORTIE_COURTE_VISEE_MS,
  DUREE_TOTALE_VISEE_MS,
  EXEMPLES_ECRANS_A_CHIFFRE,
  REPONSE_BRUTE_MAX,
  dureeDiteMs,
  dureesDesFins,
  ecrireFiche,
  ficheParGabarit,
  type EntreeEcriture,
} from "@/moteurs/montage-cas-concret/ecriture";
import { regrouperFins } from "@/moteurs/montage-cas-concret/etapes";
import { schemaEcranCorps, texteDuCorps, validerSchemaFiche, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { planDesFins } from "@/moteurs/montage-cas-concret/fins";
import { ENTETE_REPONSE_BRUTE } from "@/moteurs/montage-cas-concret";
import type { EntreeRole } from "@/generateur/roles/types";
import type { OutilsEcriture, ReponseAppelEcriture } from "@/moteurs/montage-cas-concret/outils";
import { TENUE_FINALE_MS, validerFicheEcrans } from "@/moteurs/montage-cas-concret/regles";
import { ecritureDuTravail } from "@/services/cas-concret-vue";
import { doubles } from "../fabriquer/doubles";
import { commandeCasConcret, versOutils } from "../moteur/doubles";

const cas = trouverCas("recrutement-apporteurs")!;
const RESEAUX: ReseauCas[] = ["facebook", "instagram", "tiktok", "linkedin"];
const FIXE = { videoId: "v-3a71b4a4dfea", versionId: "ver-x9", habillage: "charte-duo/1", origine: "porte-a" } as const;
/** Les fins réellement planifiées pour l'essai : 4 réseaux, sans le mot. */
const plan = regrouperFins(planDesFins({ reseaux: RESEAUX, offre: cas.offre, ...(cas.nature ? { nature: cas.nature } : {}), mot: cas.mot, ...(cas.motDit ? { motDit: cas.motDit } : {}), avecMot: false, motSur: [], table: TABLE_FINS_DIAGNOSTIC }));
const entree: EntreeEcriture = { ...FIXE, cas, controle: { motsInterdits: [], fins: plan.fins } };

type Brut = Record<string, unknown> & { ecrans: Record<string, unknown>[] };
const copie = (f: FicheEcrans): Brut => structuredClone(f) as unknown as Brut;
const ficheJuste = (): FicheEcrans => ficheParGabarit(cas, FIXE, dureesDesFins(plan.fins));

/** La réponse du vrai Claude : bien formée, sans `valeur` sur les écrans à chiffre (avec ou sans leur `faitId`). */
function avecLeDefaut(f: FicheEcrans, sansFait = false): Brut {
  const b = copie(f);
  for (const e of b.ecrans) {
    if (e.type === "chiffre") {
      delete e.valeur;
      if (sansFait) delete e.faitId;
    }
    if (e.type === "resultat") {
      for (const cote of ["avant", "maintenant"]) {
        const barre = e[cote] as Record<string, unknown>;
        if (barre.faitId === undefined) continue;
        delete barre.valeur;
        if (sansFait) delete barre.faitId;
      }
    }
  }
  return b;
}

const production = (texte: string): ReponseAppelEcriture => ({ ok: true, simule: false, texte, stopReason: "end_turn", coutUsd: 0.12 });

function double(reponses: unknown[]): OutilsEcriture & { appels: EntreeRole[] } {
  const appels: EntreeRole[] = [];
  return {
    appels,
    appeler: async (_role, e) => {
      appels.push(e);
      const r = reponses[appels.length - 1];
      if (r === undefined) throw new Error("appel de trop");
      return production(typeof r === "string" ? r : JSON.stringify(r));
    },
    budget: { reserver: async () => ({ ok: true }) },
  };
}

describe("X9 · rejouer le cas réel", () => {
  it("le défaut porte bien sur l'écran chiffre et les deux barres du résultat", () => {
    const f = avecLeDefaut(ficheJuste());
    const touches = f.ecrans.filter((e) => e.type === "chiffre" || e.type === "resultat");
    expect(touches.map((e) => e.type)).toEqual(["chiffre", "resultat"]);
    // Avant X9, exactement les refus vus à l'écran.
    const avant = validerSchemaFiche(f);
    expect(avant.ok ? [] : avant.problemes.map((p) => p.message.replace(/^Écran e\d+/, "Écran"))).toEqual([
      "Écran · règle « schéma exact » : champ « valeur » : champ obligatoire absent.",
      "Écran · règle « schéma exact » : champ « avant », champ « valeur » : champ obligatoire absent.",
      "Écran · règle « schéma exact » : champ « maintenant », champ « valeur » : champ obligatoire absent.",
    ]);
  });

  it("sans `valeur`, avec `faitId` : la fiche passe au premier appel, les 22 règles passent, la durée est dans la visée", async () => {
    const juste = ficheJuste();
    const d = double([avecLeDefaut(juste), avecLeDefaut(juste)]);
    const r = await ecrireFiche(entree, d);
    expect(r.ok ? [] : r.refus).toEqual([]);
    if (!r.ok) return;
    expect(r.appels).toBe(1);
    // La valeur posée est celle du fait : la fiche est exactement la fiche juste, sans écart à noter.
    expect(r.fiche).toEqual(juste);
    expect(r.notes).toEqual([]);
    const chiffre = r.fiche.ecrans.find((e) => e.type === "chiffre");
    expect(chiffre?.type === "chiffre" && cas.faits.find((f) => f.id === chiffre.faitId)?.valeurs).toContain(chiffre?.type === "chiffre" ? chiffre.valeur : NaN);
    const v = validerFicheEcrans(r.fiche, { cas, texteScript: texteDuCorps(r.fiche), fins: plan.fins, motsInterdits: [] });
    expect(v.ok ? [] : v.problemes.map((p) => p.message)).toEqual([]);
    const durees = plan.fins.map((f) => dureeDiteMs(r.fiche.ecrans) + dureeDiteMs(f.ecrans) + TENUE_FINALE_MS);
    expect(Math.min(...durees)).toBeGreaterThanOrEqual(DUREE_SORTIE_COURTE_VISEE_MS.min);
    expect(Math.min(...durees)).toBeLessThanOrEqual(DUREE_SORTIE_COURTE_VISEE_MS.max);
    for (const ms of durees) {
      expect(ms).toBeGreaterThanOrEqual(DUREE_TOTALE_VISEE_MS.min);
      expect(ms).toBeLessThanOrEqual(DUREE_TOTALE_VISEE_MS.max);
    }
  });

  it("sans `valeur` ni `faitId` : refus clair, renvoyé au second essai, puis échec avec la réponse brute gardée", async () => {
    const mauvaise = avecLeDefaut(ficheJuste(), true);
    const d = double([mauvaise, mauvaise]);
    const r = await ecrireFiche(entree, d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motif).toBe("refusee");
    expect(d.appels).toHaveLength(2);
    expect(r.refus).toEqual([
      expect.stringMatching(/^Écran e\d{2} · règle « nombres des faits » : le chiffre ne désigne aucun fait : donnez « faitId »/),
      expect.stringMatching(/^Écran e\d{2} · règle « nombres des faits » : la barre « avant » ne désigne aucun fait/),
      expect.stringMatching(/^Écran e\d{2} · règle « nombres des faits » : la barre « maintenant » ne désigne aucun fait/),
    ]);
    // Le « champ valeur absent » n'est pas redit par le schéma.
    expect(r.refus.join(" ")).not.toContain("champ obligatoire absent");
    // Le second essai reçoit ces refus.
    expect(d.appels[1].variable).toContain("ne désigne aucun fait : donnez « faitId »");
    expect(r.reponseBrute).toBe(JSON.stringify(mauvaise));
  });
});

describe("X9 · le code remplit, Claude désigne", () => {
  it("une `valeur` différente de celle du fait : celle du fait gagne, l'écart est noté", async () => {
    const juste = ficheJuste();
    const b = copie(juste);
    const chiffre = b.ecrans.find((e) => e.type === "chiffre")!;
    chiffre.valeur = 42;
    const r = await ecrireFiche(entree, double([b]));
    expect(r.ok && r.fiche).toEqual(juste);
    expect(r.ok && r.notes).toEqual([expect.stringContaining(`${String(chiffre.id)} : « valeur » rendu 42, remplacé par`)]);
  });

  it("un `faitId` inconnu reste un refus (R12), renvoyé au second essai", async () => {
    const b = avecLeDefaut(ficheJuste());
    b.ecrans.find((e) => e.type === "chiffre")!.faitId = "fait-invente";
    const d = double([b, b]);
    const r = await ecrireFiche(entree, d);
    expect(!r.ok && r.refus).toEqual([expect.stringContaining("désigne le fait \"fait-invente\", absent du cas")]);
    expect(d.appels).toHaveLength(2);
  });

  it("un fait sans nombre ne peut pas porter un chiffre", () => {
    const b = avecLeDefaut(ficheJuste());
    const sansNombre = cas.faits.find((f) => !f.valeurs.length);
    const casAvec: CasConcret = sansNombre ? cas : { ...cas, faits: [...cas.faits, { id: "sans-nombre", enonce: "Le dossier est classé.", valeurs: [], source: "code", preuve: "essai" }] };
    b.ecrans.find((e) => e.type === "chiffre")!.faitId = sansNombre?.id ?? "sans-nombre";
    expect(completerFiche(b, { ...FIXE, cas: casAvec }).refus).toEqual([expect.stringContaining("qui ne porte aucun nombre")]);
  });

  it("la valeur posée est celle que le texte dit cite, quand le fait en porte plusieurs", () => {
    const b = avecLeDefaut(ficheJuste());
    const chiffre = b.ecrans.find((e) => e.type === "chiffre")!;
    Object.assign(chiffre, { faitId: "delai-invitation", texteDit: "L'invitation part 20 minutes après le dossier." });
    const c = completerFiche(b, { ...FIXE, cas });
    expect((c.brute as Brut).ecrans.find((e) => e.type === "chiffre")!.valeur).toBe(20);
  });
});

describe("X9 · point 4 : Claude ne rend que ce qu'il est seul à pouvoir écrire", () => {
  /** Retire tout champ classé « cas » ou « calcul ». */
  function seulementClaude(f: FicheEcrans): Brut {
    const b = copie(f);
    const garder = (o: Record<string, unknown>, groupe: string) => {
      for (const [k, sorte] of Object.entries(CLASSEMENT_CHAMPS[groupe] ?? {})) if (sorte !== "claude") delete o[k];
    };
    garder(b, "fiche");
    for (const e of b.ecrans) {
      garder(e, "ecran");
      garder(e, String(e.type));
      for (const ev of e.evenements as Record<string, unknown>[]) garder(ev, "evenement");
      const visuel = e.visuel as Record<string, unknown> | undefined;
      if (visuel) garder(visuel, `visuel-${String(visuel.sorte)}`);
      for (const cote of ["avant", "maintenant"]) if (e[cote]) garder(e[cote] as Record<string, unknown>, "barre");
    }
    return b;
  }

  it("une fiche réduite aux seuls champs de Claude, complétée par le code, redevient la fiche juste", () => {
    const juste = ficheJuste();
    const reduite = seulementClaude(juste);
    expect(Object.keys(reduite)).toEqual(["ecrans"]);
    expect(JSON.stringify(reduite)).not.toContain("\"valeur\"");
    expect(JSON.stringify(reduite)).not.toContain("\"marque\"");
    const c = completerFiche(reduite, { ...FIXE, cas });
    expect(c.refus).toEqual([]);
    expect(c.brute).toEqual(juste);
  });

  it("chaque champ obligatoire de chaque type du corps est classé", () => {
    const obligatoires = (shape: Record<string, { safeParse: (v: unknown) => { success: boolean } }>) => Object.keys(shape).filter((k) => !shape[k].safeParse(undefined).success);
    for (const option of schemaEcranCorps.options) {
      const shape = option.shape as unknown as Record<string, { safeParse: (v: unknown) => { success: boolean } }>;
      const type = String((shape.type as unknown as { value: string }).value);
      for (const k of obligatoires(shape)) expect(CLASSEMENT_CHAMPS.ecran[k] ?? CLASSEMENT_CHAMPS[type]?.[k], `${type}.${k}`).toBeDefined();
    }
  });
});

describe("X9 · point 2 : la consigne dit la vérité", () => {
  it("elle ne demande plus `valeur`, et dit que le studio la pose", () => {
    expect(CONSIGNE_ECRITURE).not.toMatch(/"valeur",|« valeur » = /);
    expect(CONSIGNE_ECRITURE).toContain("tu ne rends jamais « valeur »");
    expect(CONSIGNE_ECRITURE).toContain("{ \"libelle\", \"faitId\" }");
  });

  it("un exemple complet de chaque écran à chiffre, montré tel quel et valide une fois complété", () => {
    expect(EXEMPLES_ECRANS_A_CHIFFRE.map((x) => x.type)).toEqual(["chiffre", "resultat"]);
    const casExemple: CasConcret = {
      ...cas,
      faits: [...cas.faits, { id: "duree-echange", enonce: "L'échange dure 15 minutes.", valeurs: [15], source: "code", preuve: "essai" }, { id: "temps-avant", enonce: "Une heure avant.", valeurs: [1], source: "estimation", preuve: "essai" }],
    };
    for (const x of EXEMPLES_ECRANS_A_CHIFFRE) {
      expect(CONSIGNE_ECRITURE).toContain(JSON.stringify(x));
      expect(JSON.stringify(x)).not.toContain("\"valeur\"");
      const c = completerFiche({ ecrans: [structuredClone(x)] }, { ...FIXE, cas: casExemple });
      expect(c.refus).toEqual([]);
      const v = validerSchemaFiche(c.brute);
      expect(v.ok ? [] : v.problemes.map((p) => p.message)).toEqual([]);
    }
  });
});

describe("X9 · point 5 : la réponse brute d'une écriture refusée", () => {
  it("tronquée à 20 000 caractères", async () => {
    const longue = `{"ecrans": [${"x".repeat(30_000)}`;
    const r = await ecrireFiche(entree, double([longue, longue]));
    expect(r.ok).toBe(false);
    expect(REPONSE_BRUTE_MAX).toBe(20_000);
    expect(!r.ok && r.reponseBrute?.length).toBe(20_001);
    expect(!r.ok && r.reponseBrute?.startsWith("{\"ecrans\": [xxx")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Le moteur : diagnostic, « Réessayer » et texte écrit                  */
/* ------------------------------------------------------------------ */

const T0 = Date.UTC(2026, 9, 13, 9, 0, 0);
const ctx = { travailId: "t-x9", versionId: "ver-x9", titre: "Essai", maintenant: T0 };

/** Chaîne des doubles, appels détachés : réponses gardées (elles survivent à l'échec), réservations comptées. */
function banc(sansFait: boolean) {
  const d = doubles({ avecMot: false, retoucherFiche: (f) => avecLeDefaut(f as unknown as FicheEcrans, sansFait) });
  const reponses = new Map<string, ReponseAppelEcriture>();
  const lances: string[] = [];
  let reservations = 0;
  const base = versOutils(d);
  const moteur = creerMoteurMontageCasConcret({
    outils: async () => ({
      ...base,
      ecriture: {
        ...base.ecriture,
        budget: {
          reserver: async (demande) => {
            reservations++;
            return base.ecriture.budget.reserver(demande);
          },
        },
        detache: {
          // La réponse arrive aussitôt (relue au passage suivant).
          lancer: (cle, appel) => {
            lances.push(cle);
            void appel().then((r) => reponses.set(cle, r));
          },
          lire: async (cle) => reponses.get(cle) ?? null,
        },
      },
    }),
  });
  const commande: CommandeFabrication = commandeCasConcret(d, RESEAUX);
  async function passer(depart: Travail, debut: number) {
    let t = depart;
    for (let n = 0; n < 400; n++) {
      const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, debut + n * 5_000);
      t = r.travail;
      if (t.statut === "termine" || t.statut === "echec") return { travail: t, resultat: r.resultat };
    }
    throw new Error(`Bloqué (${t.statut}).`);
  }
  return { d, moteur, commande, reponses, lances, passer, reservations: () => reservations };
}

describe("X9 · le moteur", () => {
  it("écriture refusée : la réponse brute est dans l'étape, lisible par le pli « Détail technique » ; aucun texte encore", async () => {
    const b = banc(true);
    const { travail } = await b.passer(await b.moteur.lancer(b.commande, ctx), T0);
    expect(travail.statut).toBe("echec");
    const etape = travail.etapes.find((e) => e.cle === "ecriture")!;
    expect(etape.statut).toBe("echec");
    expect(etape.erreur?.messagePourWill).toContain("ne désigne aucun fait");
    expect(etape.erreur?.detailTechnique).toContain(ENTETE_REPONSE_BRUTE);
    expect(etape.erreur?.detailTechnique).toContain("\"ecrans\"");
    const vue = ecritureDuTravail(travail);
    expect(vue.detailTechnique).toBe(etape.erreur?.detailTechnique);
    expect(vue.texteDit).toBeNull();
  });

  it("« Réessayer » après le correctif : même vidéo, la réponse déjà payée est relue (aucun nouvel appel ni réservation)", async () => {
    const b = banc(true);
    const echoue = await b.passer(await b.moteur.lancer(b.commande, ctx), T0);
    expect(echoue.travail.statut).toBe("echec");
    expect(b.lances).toHaveLength(2);
    expect(b.reservations()).toBe(2);
    // Les réponses gardées deviennent celles du vrai Claude (faits désignés, `valeur` absente), que l'ancien code refusait.
    const juste = ficheJuste();
    const commeLeVraiClaude = (texte: string) => {
      const f = JSON.parse(texte) as Brut;
      f.ecrans.forEach((e, i) => {
        const j = juste.ecrans[i] as unknown as Record<string, unknown>;
        expect(e.type).toBe(j.type);
        if (e.type === "chiffre") e.faitId = j.faitId;
        if (e.type === "resultat") for (const cote of ["avant", "maintenant"]) (e[cote] as Record<string, unknown>).faitId = (j[cote] as Record<string, unknown>).faitId;
      });
      return texte.length && JSON.stringify(f);
    };
    for (const [cle, r] of b.reponses) if (r.ok && r.texte) b.reponses.set(cle, { ...r, texte: commeLeVraiClaude(r.texte) as string });
    expect([...b.reponses.values()].every((r) => r.ok && r.texte && !r.texte.includes("\"valeur\":1,") && r.texte.includes("faitId"))).toBe(true);

    const relance = await b.moteur.reessayer(echoue.travail, T0 + 60_000);
    const fin = await b.passer(relance, T0 + 60_000);
    expect(fin.travail.statut).toBe("termine");
    expect(fin.travail.id).toBe(echoue.travail.id);
    expect(fin.travail.cibleId).toBe(b.commande.videoId);
    // Coût déjà payé compté une fois : ni nouvel appel, ni nouvelle réservation.
    expect(b.lances).toHaveLength(2);
    expect(b.reservations()).toBe(2);
    expect(b.d.appelsEcriture()).toBe(2);
    // Le texte écrit et les vrais sous-titres arrivent avec le résultat.
    const texte = ecritureDuTravail(fin.travail).texteDit;
    expect(texte).toBeTruthy();
    expect(texte).not.toContain(cas.cible);
    const mots = fin.resultat?.sousTitres?.flatMap((s) => s.mots.map((m) => m.mot)).join(" ") ?? "";
    expect(mots.length).toBeGreaterThan(0);
    expect(fin.resultat?.sousTitres?.[0]?.mots[0]?.mot).toBe(texte!.split(/\s+/)[0]);
  });
});
