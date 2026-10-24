/** V3-C : service des carrousels (cycle de vie, interrupteur). Tout est injecté : faux texte, fausse porte, faux rendu, horloge fixe. */
import { describe, expect, it, vi } from "vitest";
import { DepotMemoire } from "@/donnees/memoire";
import { STATUTS_VISUEL, TRANSITIONS, type StatutVisuel } from "@/domaine/visuels/statuts";
import type { Porte, RapportPorte } from "@/domaine/visuels/contrats";
import type { CarrouselSpecType } from "@/domaine/visuels/types";
import type { Visuel } from "@/domaine/visuels/visuel";
import type { ResultatRendu } from "@/visuels/services/rendu";
import { creerDepuisSujet, deposerSession, ErreurVisuel, lancerRendu, masquerSecrets, refaire, refuser, valider, type DependancesCarrousels } from "@/visuels/services/carrousels";
import { MODELE_PAQUET } from "@/visuels/texte/aide-format";

const SPEC = { version: "carrousel/1", alt: "Carrousel inventé", pages: [{ type: "T01", titre: "Titre inventé" }, { type: "T21" }] } as CarrouselSpecType;
const SPEC_CORRIGE = { ...SPEC, alt: "Carrousel inventé corrigé" } as CarrouselSpecType;
const RENDU: ResultatRendu = {
  empreinte: "e".repeat(64),
  pages: [{ index: 0, x1: { cle: "k/p1x1.jpg", mesures: {} }, x2: { cle: "k/p1x2.jpg", mesures: {} } }, { index: 1, x1: { cle: "k/p2x1.jpg", mesures: {} }, x2: { cle: "k/p2x2.jpg", mesures: {} } }],
  pdfCle: "k/c.pdf",
  vignetteCle: "k/p1x1.jpg",
};
const rapport = (verdict: RapportPorte["verdict"]): RapportPorte => ({
  version: "porte-carrousel/1",
  verdict,
  controles: verdict === "vert" ? [] : [{ code: "C1", niveau: verdict, phrase: "Contrôle inventé" }],
  corrections: [],
});

function monter(options: { allume?: boolean; verdict?: RapportPorte["verdict"]; rendu?: () => Promise<ResultatRendu> } = {}) {
  const depot = new DepotMemoire<Visuel>();
  let instant = Date.parse("2026-10-19T10:00:00.000Z");
  let allume = options.allume ?? true;
  let verdict = options.verdict ?? "vert";
  let chaine: Promise<unknown> = Promise.resolve();
  const ecrire = vi.fn(async (_d: unknown) => ({ titre: "Titre écrit", spec: SPEC, pourquoi: ["Parce que inventé"], mode: "simulation" as const }));
  const texte = vi.fn((d: unknown) => ({ mode: "simulation" as const, ecrire: (x: never) => ecrire(x) }) as never);
  const porte = vi.fn(((spec: unknown) => ({ rapport: rapport(verdict), specCorrige: verdict === "rouge" ? undefined : SPEC_CORRIGE })) as Porte);
  const rendre = vi.fn(options.rendu ?? (async () => RENDU));
  const parametres = new Map<string, unknown>();
  const deps: DependancesCarrousels = {
    depot,
    texte,
    porte,
    contextePorte: async () => ({ interditsDans: () => [], faitsDisponibles: false }),
    allume: async () => allume,
    rendre,
    rendreReseaux: async () => [],
    urlLecture: async (cle) => `https://stockage.invente/${cle}`,
    verrou: (f) => {
      const suite = chaine.then(f, f);
      chaine = suite.catch(() => undefined);
      return suite;
    },
    maintenant: () => new Date(instant).toISOString(),
    lireParametre: async <T>(id: string, defaut: T) => (parametres.has(id) ? (parametres.get(id) as T) : defaut),
    ecrireParametre: async (id, v) => void parametres.set(id, v),
  };
  return {
    deps,
    depot,
    texte,
    ecrire,
    porte,
    rendre,
    avancer: (ms: number) => void (instant += ms),
    eteindre: () => void (allume = false),
    verdict: (v: RapportPorte["verdict"]) => void (verdict = v),
  };
}

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof ErreurVisuel ? e.code : `AUTRE:${String(e)}`;
  }
  return "AUCUNE";
};

async function amener(m: ReturnType<typeof monter>, statut: StatutVisuel, extra: Partial<Visuel> = {}): Promise<string> {
  const id = `vis_${statut}`;
  const maintenant = m.deps.maintenant();
  await m.depot.enregistrer({
    id, famille: "carrousel", titre: "Titre", entree: { type: "sujet", sujet: "Un sujet inventé" }, statut, modeTexte: "simulation", spec: SPEC,
    pourquoi: [], versionSpec: 1, coutCentimes: 0, creeLe: maintenant, modifieLe: maintenant, ...extra,
  });
  return id;
}

describe("creerDepuisSujet", () => {
  it("éteint : GENERATEUR_ETEINT, aucune écriture, 0 appel au texte ni au rendu", async () => {
    const m = monter({ allume: false });
    expect(await code(creerDepuisSujet("Les erreurs de trésorerie", m.deps))).toBe("GENERATEUR_ETEINT");
    expect(await code(deposerSession("contenu de session inventé", m.deps))).toBe("GENERATEUR_ETEINT");
    const id = await amener(m, "ecrit");
    expect(await code(lancerRendu(id, m.deps))).toBe("GENERATEUR_ETEINT");
    expect(await m.depot.compter()).toBe(1);
    expect(m.texte).not.toHaveBeenCalled();
    expect(m.ecrire).not.toHaveBeenCalled();
    expect(m.rendre).not.toHaveBeenCalled();
  });

  it("sujet de moins de 3 ou plus de 200 signes, ou avec un lien : SUJET_INVALIDE, rien écrit", async () => {
    const m = monter();
    for (const s of ["ab", "  a ", "x".repeat(201), "Voir https://exemple.fr", "Voir www.exemple.fr", "écrire à axion-ia.com"]) {
      expect(await code(creerDepuisSujet(s, m.deps)), s).toBe("SUJET_INVALIDE");
    }
    expect(await m.depot.compter()).toBe(0);
    expect(m.texte).not.toHaveBeenCalled();
  });

  it("chemin heureux : id vis_…, statut ecrit, spec corrigé par la porte appliqué, coût 0", async () => {
    const m = monter();
    const { id } = await creerDepuisSujet("  Les erreurs de trésorerie ", m.deps);
    expect(id).toMatch(/^vis_[0-9a-f-]{36}$/);
    const v = (await m.depot.obtenir(id))!;
    expect(v).toMatchObject({ statut: "ecrit", famille: "carrousel", titre: "Titre écrit", versionSpec: 1, coutCentimes: 0, modeTexte: "simulation", entree: { type: "sujet", sujet: "Les erreurs de trésorerie" } });
    expect(v.spec).toEqual(SPEC_CORRIGE);
    expect(v.rapport?.verdict).toBe("vert");
    expect(v.pourquoi).toEqual(["Parce que inventé"]);
  });

  it("porte orange : ecrit ; porte rouge : bloque, rapport gardé, aucun rendu possible", async () => {
    const o = monter({ verdict: "orange" });
    expect((await o.depot.obtenir((await creerDepuisSujet("Sujet orange", o.deps)).id))!.statut).toBe("ecrit");
    const r = monter({ verdict: "rouge" });
    const { id } = await creerDepuisSujet("Sujet rouge", r.deps);
    const v = (await r.depot.obtenir(id))!;
    expect(v.statut).toBe("bloque");
    expect(v.rapport?.verdict).toBe("rouge");
    expect(await code(lancerRendu(id, r.deps))).toBe("TRANSITION_REFUSEE");
    expect(r.rendre).not.toHaveBeenCalled();
  });

  it("double clic : même sujet normalisé en moins de 60 s → un seul document, un seul appel au texte", async () => {
    const m = monter();
    const [a, b] = await Promise.all([creerDepuisSujet("Les erreurs  de TRÉSORERIE", m.deps), creerDepuisSujet(" les erreurs de trésorerie ", m.deps)]);
    expect(a.id).toBe(b.id);
    expect(await m.depot.compter()).toBe(1);
    expect(m.ecrire).toHaveBeenCalledTimes(1);
    m.avancer(30_000);
    expect((await creerDepuisSujet("Les erreurs de trésorerie", m.deps)).id).toBe(a.id);
    m.avancer(31_000);
    expect((await creerDepuisSujet("Les erreurs de trésorerie", m.deps)).id).not.toBe(a.id);
    expect(await m.depot.compter()).toBe(2);
  });

  it("l'écriture du texte qui échoue laisse un visuel bloqué avec une phrase claire", async () => {
    const m = monter();
    m.ecrire.mockRejectedValueOnce(new Error("panne inventée"));
    const { id } = await creerDepuisSujet("Sujet en panne", m.deps);
    const v = (await m.depot.obtenir(id))!;
    expect(v.statut).toBe("bloque");
    expect(v.erreur).toMatch(/texte/i);
  });
});

describe("deposerSession", () => {
  it("entrée session, mode session, paquet transmis tel quel", async () => {
    const m = monter();
    m.texte.mockReturnValueOnce({ mode: "session", ecrire: async () => ({ titre: "Depuis la session", spec: SPEC, pourquoi: [], mode: "session" }) } as never);
    const { id } = await deposerSession(MODELE_PAQUET, m.deps);
    expect(m.texte).toHaveBeenCalledWith({ type: "paquet-session", contenu: MODELE_PAQUET });
    expect(await m.depot.obtenir(id)).toMatchObject({ entree: { type: "session" }, modeTexte: "session", statut: "ecrit", titre: "Depuis la session" });
  });
  it("contenu vide : PAQUET_INVALIDE", async () => {
    const m = monter();
    expect(await code(deposerSession("   ", m.deps))).toBe("PAQUET_INVALIDE");
    expect(await m.depot.compter()).toBe(0);
  });
  it("un fournisseur en mode api est refusé avant tout appel : API_PAYANTE_VERROUILLEE", async () => {
    const m = monter();
    const ecrire = vi.fn();
    m.texte.mockReturnValueOnce({ mode: "api", ecrire } as never);
    expect(await code(creerDepuisSujet("Sujet payant", m.deps))).toBe("API_PAYANTE_VERROUILLEE");
    expect(ecrire).not.toHaveBeenCalled();
    expect(await m.depot.compter()).toBe(0);
  });
});

describe("masquerSecrets", () => {
  it.each([
    ["clé seule sans Bearer", "échec sk-ant-api03-ABCDEFGHIJKL fin", "sk-ant-api03"],
    ["token= hors URL, en début de texte", "token=abc123 reste", "abc123"],
    ["password= en début de texte", "password=hunter2", "hunter2"],
    ["api_key=", "appel api_key=zzTOPzz", "zzTOPzz"],
    ["access_token=", "x access_token=zzTOPzz", "zzTOPzz"],
    ["R2_SECRET_ACCESS_KEY=", "R2_SECRET_ACCESS_KEY=zzTOPzz", "zzTOPzz"],
    ["x-api-key:", "x-api-key: zzTOPzz", "zzTOPzz"],
    ["jeton de 32 signes", "jeton abcdefghijklmnopqrstuvwxyz012345 fin", "abcdefghijklmnopqrstuvwxyz012345"],
    ["JSON", '{"password":"hunter2","a":1}', "hunter2"],
    ["adresse postgresql avec mot de passe", "postgresql://user:hunter2@h:5432/db", "hunter2"],
    ["adresse redis sans utilisateur", "redis://:hunter2@h:6379", "hunter2"],
    ["adresse https avec mot de passe", "https://user:hunter2@h/x", "hunter2"],
    ["Bearer", "Authorization: Bearer abc.def-ghi", "abc.def-ghi"],
    ["URL signée", "GET https://r2.exemple/x?X-Amz-Signature=abc123def456 ko", "abc123def456"],
  ])("masque : %s", (_nom, entree, secret) => {
    const sortie = masquerSecrets(entree);
    expect(sortie).not.toContain(secret);
    expect(sortie).toMatch(/masqué|masquée/);
  });
  it("reste linéaire : 100 000 signes en moins de 200 ms", () => {
    for (const bloc of ["http://", "a=", "https://u:", "token=", "a".repeat(40) + " "]) {
      const t0 = performance.now();
      masquerSecrets(bloc.repeat(Math.ceil(100_000 / bloc.length)));
      expect(performance.now() - t0).toBeLessThan(200);
    }
  });
});

describe("lancerRendu", () => {
  it("échec → echec_rendu avec phrase ; relancer → a_valider avec le rendu", async () => {
    let n = 0;
    const m = monter({ rendu: async () => { if (n++ === 0) throw new Error("page 2 déborde"); return RENDU; } });
    const { id } = await creerDepuisSujet("Sujet de rendu", m.deps);
    await lancerRendu(id, m.deps);
    const echec = (await m.depot.obtenir(id))!;
    expect(echec.statut).toBe("echec_rendu");
    expect(echec.erreur).toBeTruthy();
    await lancerRendu(id, m.deps);
    const ok = (await m.depot.obtenir(id))!;
    expect(ok.statut).toBe("a_valider");
    expect(ok.erreur).toBeUndefined();
    expect(ok.rendu).toMatchObject({ empreinte: RENDU.empreinte, pdfCle: "k/c.pdf", vignetteCle: "k/p1x1.jpg", renduLe: m.deps.maintenant() });
    expect(ok.rendu?.pages).toEqual([{ index: 0, x1Cle: "k/p1x1.jpg", x2Cle: "k/p1x2.jpg" }, { index: 1, x1Cle: "k/p2x1.jpg", x2Cle: "k/p2x2.jpg" }]);
  });
  it("échec inattendu : l'erreur réelle est journalisée (secrets masqués), la base garde la phrase fixe", async () => {
    const journal = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const cause = new Error("racine https://r2.exemple/x?X-Amz-Signature=abc123def456 refusée");
      const m = monter({ rendu: async () => { throw new Error("ENOENT /app/assemblage-pdf Bearer sk-ant-api03-SECRETSECRETSECRET", { cause }); } });
      const { id } = await creerDepuisSujet("Sujet journal", m.deps);
      await lancerRendu(id, m.deps);
      const lignes = journal.mock.calls.map((a) => a.map(String).join(" ")).join("\n");
      expect(lignes).toContain("[carrousels] rendu échoué");
      expect(lignes).toContain(`visuel ${id} |`);
      expect(lignes).toContain("ENOENT /app/assemblage-pdf");
      expect(lignes).toContain("racine");
      expect(lignes).toContain("at ");
      expect(lignes).not.toMatch(/SECRETSECRET|abc123def456|X-Amz-Signature=abc/);
      const v = (await m.depot.obtenir(id))!;
      expect(v.statut).toBe("echec_rendu");
      expect(v.erreur).toBe("Le rendu a échoué : réessayez avec « Relancer le rendu »");
    } finally {
      journal.mockRestore();
    }
  });
  it("message contenant « mesure » → serveur de rendu non relié", async () => {
    const m = monter({ rendu: async () => { throw new Error("mesure des débordements absente"); } });
    const { id } = await creerDepuisSujet("Sujet sans serveur", m.deps);
    await lancerRendu(id, m.deps);
    expect((await m.depot.obtenir(id))!.erreur).toBe("Le serveur de rendu n'est pas relié : aucun aperçu");
  });
  it("jeton de rendu : le même instant écrit autrement (+00:00) conclut quand même", async () => {
    // eslint-disable-next-line prefer-const -- affectée plus bas : la fermeture de `rendu` la lit au moment du rendu
    let reformater: (() => Promise<unknown>) | undefined;
    const m = monter({ rendu: async () => { await reformater?.(); return RENDU; } });
    const { id } = await creerDepuisSujet("Sujet jeton", m.deps);
    reformater = async () => {
      const v = (await m.depot.obtenir(id))!;
      return m.depot.modifier(id, { renduDemandeLe: v.renduDemandeLe!.replace("Z", "+00:00") });
    };
    await lancerRendu(id, m.deps);
    expect((await m.depot.obtenir(id))!.statut).toBe("a_valider");
  });
  it("déjà en cours depuis moins de 10 min : rien ; au-delà : relancé", async () => {
    const m = monter();
    const id = await amener(m, "rendu_en_cours", { renduDemandeLe: m.deps.maintenant() });
    m.avancer(9 * 60_000);
    await lancerRendu(id, m.deps);
    expect(m.rendre).not.toHaveBeenCalled();
    expect((await m.depot.obtenir(id))!.statut).toBe("rendu_en_cours");
    m.avancer(2 * 60_000);
    await lancerRendu(id, m.deps);
    expect(m.rendre).toHaveBeenCalledTimes(1);
    expect((await m.depot.obtenir(id))!.statut).toBe("a_valider");
  });
  it("deux lancements simultanés : un seul rendu", async () => {
    const m = monter();
    const { id } = await creerDepuisSujet("Sujet double rendu", m.deps);
    await Promise.all([lancerRendu(id, m.deps), lancerRendu(id, m.deps)]);
    expect(m.rendre).toHaveBeenCalledTimes(1);
  });
  it("le spec rendu est celui du visuel", async () => {
    const m = monter();
    const { id } = await creerDepuisSujet("Sujet spec", m.deps);
    await lancerRendu(id, m.deps);
    expect(m.rendre).toHaveBeenCalledWith(SPEC_CORRIGE);
  });
  it("introuvable : INTROUVABLE", async () => {
    const m = monter();
    expect(await code(lancerRendu("vis_absent", m.deps))).toBe("INTROUVABLE");
  });
});

describe("valider, refuser, refaire", () => {
  it("valider : a_valider → valide, date posée", async () => {
    const m = monter();
    const id = await amener(m, "a_valider");
    await valider(id, m.deps);
    expect(await m.depot.obtenir(id)).toMatchObject({ statut: "valide", valideLe: m.deps.maintenant() });
  });
  it("refuser : motif, page et commentaire gardés ; commentaire limité à 500", async () => {
    const m = monter();
    const id = await amener(m, "a_valider");
    await refuser(id, "texte", 1, "x".repeat(900), m.deps);
    const v = (await m.depot.obtenir(id))!;
    expect(v.statut).toBe("refuse");
    expect(v.refus).toHaveLength(1);
    expect(v.refus![0]).toMatchObject({ motif: "texte", page: 1, le: m.deps.maintenant() });
    expect(v.refus![0].commentaire).toHaveLength(500);
  });
  it("refaire depuis refuse : brouillon puis réécriture, versionSpec + 1, ancien rendu effacé", async () => {
    const m = monter();
    const { id } = await creerDepuisSujet("Sujet à refaire", m.deps);
    await lancerRendu(id, m.deps);
    await refuser(id, "ton", undefined, undefined, m.deps);
    await refaire(id, m.deps);
    const v = (await m.depot.obtenir(id))!;
    expect(v.statut).toBe("ecrit");
    expect(v.versionSpec).toBe(2);
    expect(v.rendu).toBeUndefined();
    expect(m.ecrire).toHaveBeenCalledTimes(2);
    expect(v.refus).toHaveLength(1);
  });
  it("refaire depuis a_valider : refuse (« autre ») puis refaire", async () => {
    const m = monter();
    const { id } = await creerDepuisSujet("Sujet à refaire direct", m.deps);
    await lancerRendu(id, m.deps);
    await refaire(id, m.deps);
    const v = (await m.depot.obtenir(id))!;
    expect(v).toMatchObject({ statut: "ecrit", versionSpec: 2 });
    expect(v.refus?.[0].motif).toBe("autre");
  });
  it("refaire depuis bloque : repart en écriture", async () => {
    const m = monter({ verdict: "rouge" });
    const { id } = await creerDepuisSujet("Sujet bloqué", m.deps);
    m.verdict("vert");
    await refaire(id, m.deps);
    expect(await m.depot.obtenir(id)).toMatchObject({ statut: "ecrit", versionSpec: 2 });
  });
  it("refaire depuis echec_rendu (mise en page refusée) : repart en écriture, erreur effacée", async () => {
    const m = monter({ rendu: async () => { throw new Error("La page 2 déborde de 40 px"); } });
    const { id } = await creerDepuisSujet("Sujet trop long", m.deps);
    await lancerRendu(id, m.deps);
    expect(await m.depot.obtenir(id)).toMatchObject({ statut: "echec_rendu" });
    await refaire(id, m.deps);
    const v = (await m.depot.obtenir(id))!;
    expect(v).toMatchObject({ statut: "ecrit", versionSpec: 2 });
    expect(v.erreur).toBeUndefined();
  });
  it("refaire une session : SESSION_ATTENDUE, rien ne bouge", async () => {
    const m = monter();
    const id = await amener(m, "refuse", { entree: { type: "session" }, modeTexte: "session" });
    expect(await code(refaire(id, m.deps))).toBe("SESSION_ATTENDUE");
    expect(await m.depot.obtenir(id)).toMatchObject({ statut: "refuse", versionSpec: 1 });
    const m2 = monter();
    const a = await amener(m2, "a_valider", { entree: { type: "session" } });
    expect(await code(refaire(a, m2.deps))).toBe("SESSION_ATTENDUE");
    expect((await m2.depot.obtenir(a))!.statut).toBe("a_valider");
  });
  it("refaire éteint : GENERATEUR_ETEINT avant toute écriture", async () => {
    const m = monter();
    const id = await amener(m, "refuse");
    m.eteindre();
    expect(await code(refaire(id, m.deps))).toBe("GENERATEUR_ETEINT");
    expect((await m.depot.obtenir(id))!.statut).toBe("refuse");
    expect(m.ecrire).not.toHaveBeenCalled();
  });
});

describe("transitions hors table", () => {
  const actions: Record<string, { vers: StatutVisuel; lancer: (m: ReturnType<typeof monter>, id: string) => Promise<unknown> }> = {
    valider: { vers: "valide", lancer: (m, id) => valider(id, m.deps) },
    refuser: { vers: "refuse", lancer: (m, id) => refuser(id, "autre", undefined, undefined, m.deps) },
    lancerRendu: { vers: "rendu_en_cours", lancer: (m, id) => lancerRendu(id, m.deps) },
    refaire: { vers: "brouillon", lancer: (m, id) => refaire(id, m.deps) },
  };
  for (const [nom, { vers, lancer }] of Object.entries(actions)) {
    for (const statut of STATUTS_VISUEL) {
      // refaire passe aussi par « refuser » depuis a_valider ; lancerRendu sur rendu_en_cours récent est un no-op, pas une transition.
      const permis = nom === "refaire" ? statut === "a_valider" || TRANSITIONS[statut].includes("brouillon") : TRANSITIONS[statut].includes(vers);
      if (permis || (nom === "lancerRendu" && statut === "rendu_en_cours")) continue;
      it(`${nom} depuis ${statut} : TRANSITION_REFUSEE, statut inchangé`, async () => {
        const m = monter();
        const id = await amener(m, statut);
        expect(await code(lancer(m, id))).toBe("TRANSITION_REFUSEE");
        expect((await m.depot.obtenir(id))!.statut).toBe(statut);
        expect(m.rendre).not.toHaveBeenCalled();
      });
    }
  }
});

const PHRASE_PAGE_2 = "La page 2 ne tient pas dans la mise en page (le texte dépasse de son cadre) : raccourcissez ce texte ou changez de type de page.";

describe("corrections de relecture (V3-C)", () => {
  it("phraseEchec : un message brut (adresse, chemin) n'apparaît jamais dans erreur", async () => {
    const m = monter({ rendu: async () => { throw new Error("ECONNREFUSED 10.0.0.5:3000 /srv/x"); } });
    const { id } = await creerDepuisSujet("Sujet fuite", m.deps);
    await lancerRendu(id, m.deps);
    const v = (await m.depot.obtenir(id))!;
    expect(v.statut).toBe("echec_rendu");
    expect(v.erreur).toBe("Le rendu a échoué : réessayez avec « Relancer le rendu »");
    expect(JSON.stringify(v)).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|\/srv/);
  });
  it("phraseEchec : les phrases connues sont gardées", async () => {
    const m = monter({ rendu: async () => { throw new Error("La page 2 déborde de 40 px"); } });
    const { id } = await creerDepuisSujet("Sujet débord", m.deps);
    await lancerRendu(id, m.deps);
    expect((await m.depot.obtenir(id))!.erreur).toBe(PHRASE_PAGE_2);
  });
  it.each([
    ["La page 2 : un texte entre dans une zone réservée (1 ligne(s)) : rendu refusé", "zone réservée de LinkedIn"],
    ["La page 2 déborde de 40 px", "le texte dépasse de son cadre"],
    ["La page 2 a un texte sous 26 px (24)", "le texte devient trop petit pour être lu"],
    ["La page 2 : un texte en chevauche un autre ou une illustration (1 cas) : rendu refusé", "deux textes se touchent"],
  ])("phraseEchec : « %s » → une phrase par cause (%s), jamais « réessayez »", async (brut, cause) => {
    const m = monter({ rendu: async () => { throw new Error(brut); } });
    const { id } = await creerDepuisSujet("Sujet zone", m.deps);
    await lancerRendu(id, m.deps);
    const v = (await m.depot.obtenir(id))!;
    expect(v.erreur).toBe(`La page 2 ne tient pas dans la mise en page (${cause}) : raccourcissez ce texte ou changez de type de page.`);
    if (cause !== "zone réservée de LinkedIn") expect(v.erreur).not.toMatch(/LinkedIn/);
    expect(v.erreur).not.toMatch(/Relancer/);
  });
  it("phraseEchec : un jambage coupé garde la phrase de mise en page, sans « LinkedIn »", async () => {
    const m = monter({ rendu: async () => { throw new Error("La page 2 : un jambage est coupé : rendu refusé"); } });
    const { id } = await creerDepuisSujet("Sujet jambage", m.deps);
    await lancerRendu(id, m.deps);
    const e = (await m.depot.obtenir(id))!.erreur!;
    expect(e).toMatch(/^La page 2 ne tient pas dans la mise en page \(une lettre est coupée\) : raccourcissez/);
  });
  it("deposerSession : même contenu deux fois en moins de 60 s → un document, un appel au texte", async () => {
    const m = monter();
    const [a, b] = await Promise.all([deposerSession(MODELE_PAQUET, m.deps), deposerSession(MODELE_PAQUET, m.deps)]);
    expect(a.id).toBe(b.id);
    expect(await m.depot.compter()).toBe(1);
    expect(m.ecrire).toHaveBeenCalledTimes(1);
    m.avancer(61_000);
    expect((await deposerSession(MODELE_PAQUET, m.deps)).id).not.toBe(a.id);
  });
  it("refaire depuis a_valider en mode api : API_PAYANTE_VERROUILLEE, statut inchangé, refus vide", async () => {
    const m = monter();
    const id = await amener(m, "a_valider");
    m.texte.mockReturnValueOnce({ mode: "api", ecrire: vi.fn() } as never);
    expect(await code(refaire(id, m.deps))).toBe("API_PAYANTE_VERROUILLEE");
    const v = (await m.depot.obtenir(id))!;
    expect(v.statut).toBe("a_valider");
    expect(v.refus ?? []).toEqual([]);
  });
  it("un rendu qui finit après une relance ne lève rien et ne casse pas le statut", async () => {
    let n = 0;
    let liberer!: () => void;
    const m = monter({ rendu: () => (n++ === 0 ? new Promise((r) => (liberer = () => r(RENDU))) : Promise.resolve(RENDU)) });
    const id = await amener(m, "ecrit");
    const premier = lancerRendu(id, m.deps);
    await vi.waitFor(() => expect(m.rendre).toHaveBeenCalledTimes(1));
    m.avancer(11 * 60_000);
    await lancerRendu(id, m.deps);
    expect((await m.depot.obtenir(id))!.statut).toBe("a_valider");
    liberer();
    await expect(premier).resolves.toBeUndefined();
    expect((await m.depot.obtenir(id))!.statut).toBe("a_valider");
  });
  it("un vieux rendu qui échoue tard ne remplace pas la conclusion de la relance", async () => {
    let n = 0;
    let echouer!: () => void;
    let liberer!: () => void;
    const m = monter({
      rendu: () => (n++ === 0 ? new Promise((_, rej) => (echouer = () => rej(new Error("page 1 déborde")))) : new Promise((r) => (liberer = () => r(RENDU)))),
    });
    const id = await amener(m, "ecrit");
    const premier = lancerRendu(id, m.deps);
    await vi.waitFor(() => expect(m.rendre).toHaveBeenCalledTimes(1));
    m.avancer(11 * 60_000);
    const second = lancerRendu(id, m.deps);
    await vi.waitFor(() => expect(m.rendre).toHaveBeenCalledTimes(2));
    echouer();
    await premier;
    expect(await m.depot.obtenir(id)).toMatchObject({ statut: "rendu_en_cours" });
    liberer();
    await second;
    expect(await m.depot.obtenir(id)).toMatchObject({ statut: "a_valider", erreur: undefined });
  });
  it("phrases du rendu : « sous 26 px (24) » = phrase de mise en page, « mesure absente » = serveur non relié ; ancrage strict", async () => {
    const cas: [string, string][] = [
      ["La page 3 a un texte sous 26 px (24)", "La page 3 ne tient pas dans la mise en page (le texte devient trop petit pour être lu) : raccourcissez ce texte ou changez de type de page."],
      ["La page 3 a un texte sous 26 px (mesure absente)", "Le serveur de rendu n'est pas relié : aucun aperçu"],
      ["La page 3 : mesure de la police absente (rendu refusé)", "Le serveur de rendu n'est pas relié : aucun aperçu"],
      ["Le serveur du studio n'a pas fini à temps.", "Le serveur du studio n'a pas fini à temps."],
      ["Erreur interne https://x.invente/ : texte sous 26 px", "Le rendu a échoué : réessayez avec « Relancer le rendu »"],
      ["/srv/app: le truc n'a pas fini à temps", "Le rendu a échoué : réessayez avec « Relancer le rendu »"],
    ];
    for (const [message, attendu] of cas) {
      const m = monter({ rendu: async () => { throw new Error(message); } });
      const { id } = await creerDepuisSujet("Sujet de phrase", m.deps);
      await lancerRendu(id, m.deps);
      expect((await m.depot.obtenir(id))!.erreur, message).toBe(attendu);
    }
  });
  it("refuser : page entière entre 0 et nbPages-1, motif connu, sinon erreur sans écriture", async () => {
    const m = monter();
    const id = await amener(m, "a_valider");
    for (const page of [2, -1, 0.5, Number.NaN]) {
      await expect(refuser(id, "texte", page, undefined, m.deps), String(page)).rejects.toBeInstanceOf(ErreurVisuel);
    }
    await expect(refuser(id, "inconnu" as never, undefined, undefined, m.deps)).rejects.toBeInstanceOf(ErreurVisuel);
    expect(await m.depot.obtenir(id)).toMatchObject({ statut: "a_valider" });
    await refuser(id, "texte", 0, undefined, m.deps);
    expect((await m.depot.obtenir(id))!.refus![0].page).toBe(0);
  });
  it("messages de transition : libellés, pas de codes bruts", async () => {
    const m = monter();
    const id = await amener(m, "valide");
    await expect(lancerRendu(id, m.deps)).rejects.toMatchObject({ message: expect.stringContaining("Validé") });
    await expect(refaire(id, m.deps)).rejects.toMatchObject({ message: expect.not.stringMatching(/« valide »/) });
  });
  it("réponse du texte absente (null) : bloque avec « La réponse du texte est incomplète »", async () => {
    const m = monter();
    m.ecrire.mockResolvedValueOnce(null as never);
    const { id } = await creerDepuisSujet("Sujet sans réponse", m.deps);
    expect(await m.depot.obtenir(id)).toMatchObject({ statut: "bloque", erreur: "La réponse du texte est incomplète" });
    expect(m.porte).not.toHaveBeenCalled();
  });
  it("réponse du texte mal formée (titre absent) : bloque avec « La réponse du texte est incomplète »", async () => {
    const m = monter();
    m.ecrire.mockResolvedValueOnce({ spec: SPEC, pourquoi: [], mode: "simulation" } as never);
    const { id } = await creerDepuisSujet("Sujet mal formé", m.deps);
    expect(await m.depot.obtenir(id)).toMatchObject({ statut: "bloque", erreur: "La réponse du texte est incomplète" });
  });
  it("brouillon mis à la corbeille pendant la rédaction : rediger l'ignore sans erreur", async () => {
    const m = monter();
    let liberer!: () => void;
    m.ecrire.mockImplementationOnce(() => new Promise((r) => (liberer = () => r({ titre: "T", spec: SPEC, pourquoi: [], mode: "simulation" }))) as never);
    const p = creerDepuisSujet("Sujet corbeille", m.deps);
    await vi.waitFor(() => expect(m.ecrire).toHaveBeenCalledTimes(1));
    const [v] = await m.depot.lister(() => true);
    await m.depot.modifier(v.id, { corbeilleLe: m.deps.maintenant(), statutAvantCorbeille: "brouillon" });
    liberer();
    await expect(p).resolves.toMatchObject({ id: v.id });
    expect(await m.depot.obtenir(v.id)).toMatchObject({ statut: "brouillon" });
  });
});
