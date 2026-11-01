/**
 * Z3-M · écran Migration. Données 100 % fictives (« exemple »). Rendu serveur statique, aucun réseau.
 * Jetons concaténés pour les mots interdits : ils ne s'écrivent jamais en clair dans le dépôt.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EcranMigration } from "@/components/migration/EcranMigration";
import { Criteres } from "@/components/migration/Criteres";
import { FenetreLot } from "@/components/migration/FenetreLot";
import { Heros } from "@/components/migration/Heros";
import { compter, critereResiliation, postsConfirmables, type CompteMigration, type PostMigration, type PublicationReelle } from "@/components/migration/logique";
import { confirmerRetraitEtProgrammation, PLAFOND_IDS_PAR_APPEL, RAISON_NON_BRANCHE, serviceNonBranche, type ServiceImport } from "@/components/migration/services";
import { motsInterditsEnvoi } from "@/fournisseurs/publication/mots-interdits-envoi";

vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const MAINT = new Date("2026-11-10T09:00:00Z");
const post = (id: string, etat: PostMigration["etat"], reseau: PostMigration["reseau"] = "linkedin", datePrevue = "2026-11-15T10:00:00Z", cJuste?: boolean): PostMigration => ({ id, reseau, titre: `Exemple ${id}`, datePrevue, etat, cJuste });
const pub = (jour: string, o: Partial<PublicationReelle> = {}): PublicationReelle => ({ jour, premierCommentaire: true, lienVerifie: true, aVerifier: false, ...o });
const compte = (reseau: CompteMigration["reseau"], publications: PublicationReelle[]): CompteMigration => ({ id: `exemple-${reseau}`, libelle: `Compte ${reseau}`, reseau, publications });
const POSTS = [post("a", "laisse-buffer", "instagram", "2026-11-12T10:00:00Z"), post("b", "verifie-zernio"), post("c", "a-verifier"), post("d", "restant", "facebook", "2026-11-25T10:00:00Z")];

describe("z3m · comptages", () => {
  it("compte et pourcentage", () => {
    const c = compter(POSTS);
    expect(c).toMatchObject({ total: 4, enRegle: 2, pourcent: 50, ecart: 0 });
    expect(renderToStaticMarkup(<Heros posts={POSTS} />)).toContain("2 sur 4 posts en règle · 50 %");
    expect(renderToStaticMarkup(<Heros posts={POSTS} />)).toContain("Aucun doublon");
  });
  it("0 post : 0 %", () => expect(compter([]).pourcent).toBe(0));
  it("signale l'écart de somme, jamais « Aucun doublon »", () => {
    const html = renderToStaticMarkup(<Heros posts={[...POSTS, post("x", "inconnu" as never)]} />);
    expect(compter([...POSTS, post("x", "inconnu" as never)]).ecart).toBe(1);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Écart de 1 post");
    expect(html).not.toContain("Aucun doublon");
  });
});

describe("z3m · critereResiliation", () => {
  const jours = ["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10"];
  it("rempli", () => expect(critereResiliation(compte("instagram", [pub(jours[0]), pub(jours[4], { premierCommentaire: false })])).rempli).toBe(true));
  it("non rempli : sans premier commentaire", () => {
    const r = critereResiliation(compte("instagram", [pub(jours[0], { premierCommentaire: false }), pub(jours[4], { premierCommentaire: false })]));
    expect(r.premierComm).toBe("non");
    expect(r.rempli).toBe(false);
  });
  it("non rempli : un post à vérifier ou un lien non vérifié", () => {
    expect(critereResiliation(compte("facebook", [pub(jours[0]), pub(jours[4], { aVerifier: true })])).rempli).toBe(false);
    expect(critereResiliation(compte("facebook", [pub(jours[0]), pub(jours[4], { lienVerifie: false })])).rempli).toBe(false);
  });
  it("TikTok : premier commentaire sans objet", () => {
    const r = critereResiliation(compte("tiktok", [pub(jours[0], { premierCommentaire: false }), pub(jours[4], { premierCommentaire: false })]));
    expect(r.premierComm).toBe("sans-objet");
    expect(r.rempli).toBe(true);
  });
  it("moins de 5 jours ou moins de 2 publications : non rempli", () => {
    const r = critereResiliation(compte("linkedin", [pub(jours[0]), pub(jours[3])]));
    expect(r.jours).toMatchObject({ n: 4, requis: 5, ok: false });
    expect(r.rempli).toBe(false);
    expect(critereResiliation(compte("linkedin", [pub(jours[0])])).publications.ok).toBe(false);
    expect(critereResiliation(compte("linkedin", [])).rempli).toBe(false);
  });
  it("tableau : texte masqué accessible", () => {
    const html = renderToStaticMarkup(<Criteres comptes={[compte("tiktok", [])]} />);
    expect(html).toContain("sans objet");
    expect(html).toContain("sr-only");
  });
});

describe("z3m · écriture inactive par défaut", () => {
  it("service non branché : raison simple, rien d'écrit", async () => {
    expect(serviceNonBranche.disponible).toBe(false);
    expect(serviceNonBranche.raison).toBe("Disponible après l’import des brouillons");
    expect(await serviceNonBranche.creerBrouillons("A")).toEqual({ ok: false, raison: RAISON_NON_BRANCHE });
    expect(await serviceNonBranche.retirerDeBufferEtProgrammer(["b"])).toEqual({ ok: false, raison: RAISON_NON_BRANCHE });
  });
  it("boutons inactifs avec la raison", () => {
    const html = renderToStaticMarkup(<FenetreLot titre="Lot B" posts={[post("c", "a-verifier")]} comparaisons={[]} service={serviceNonBranche} maintenant={MAINT} onFermer={() => {}} />);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Retirer de Buffer et programmer/);
    expect(html).toContain("Disponible après l’import des brouillons");
    expect(html).not.toContain("mig-confirmer");
  });
});

describe("z3m · confirmation de retrait", () => {
  const faux = () => {
    const retirer = vi.fn(async (ids: string[]) => ({ ok: true as const, message: `${ids.length}` }));
    const s: ServiceImport = { ...serviceNonBranche, disponible: true, retirerDeBufferEtProgrammer: retirer };
    return { s, retirer };
  };
  const tous = [post("ok", "a-verifier", "linkedin", "2026-11-12T10:00:00Z", true), post("non", "a-verifier", "linkedin", "2026-11-12T10:00:00Z", false), post("proche", "a-verifier", "linkedin", "2026-11-10T09:20:00Z", true), post("limite", "a-verifier", "linkedin", "2026-11-10T09:30:00Z", true)];
  it("ne propose que les posts vérifiés à ≥ 30 min", () => expect(postsConfirmables(tous, MAINT).map((p) => p.id)).toEqual(["ok", "limite"]));
  it("refuse un post non vérifié ou trop proche, ne transmet que les admis", async () => {
    const { s, retirer } = faux();
    const r = await confirmerRetraitEtProgrammation(s, ["ok", "non", "proche", "zzz"], tous, MAINT);
    expect(retirer).toHaveBeenCalledWith(["ok"]);
    expect(r.refuses).toEqual([{ id: "non", motif: "non-verifie" }, { id: "proche", motif: "date-trop-proche" }, { id: "zzz", motif: "introuvable" }]);
  });
  it("rien d'admis : aucun appel", async () => {
    const { s, retirer } = faux();
    const r = await confirmerRetraitEtProgrammation(s, ["non"], tous, MAINT);
    expect(retirer).not.toHaveBeenCalled();
    expect(r.resultat.ok).toBe(false);
  });
  it("service non branché : aucun appel même avec des posts admis", async () => {
    const r = await confirmerRetraitEtProgrammation(serviceNonBranche, ["ok"], tous, MAINT);
    expect(r.resultat).toEqual({ ok: false, raison: RAISON_NON_BRANCHE });
  });
});

describe("z3m · 4 états et langue", () => {
  const donnees = { posts: POSTS, comptes: [compte("instagram", [])] };
  const vues = {
    normal: renderToStaticMarkup(<EcranMigration vue={{ etat: "normal", donnees }} maintenant={MAINT} simulation />),
    vide: renderToStaticMarkup(<EcranMigration vue={{ etat: "vide" }} maintenant={MAINT} />),
    chargement: renderToStaticMarkup(<EcranMigration vue={{ etat: "chargement" }} maintenant={MAINT} />),
    erreur: renderToStaticMarkup(<EcranMigration vue={{ etat: "erreur", message: "Lecture impossible. Réessayez plus tard." }} maintenant={MAINT} />),
  };
  it("normal", () => {
    expect(vues.normal).toContain("Les 4 posts de Buffer passent chez Zernio");
    expect(vues.normal).toContain("Rien n’est retiré de Buffer sans votre ordre.");
    expect(vues.normal).toContain("Vérifier le lot B · 1 post");
    expect(vues.normal).toContain("8 jours");
    expect(vues.normal).toContain("Mode simulation");
  });
  it("vide", () => {
    expect(vues.vide).toContain("La bascule n’a pas commencé");
    expect(vues.vide).toContain("Voir les connexions");
  });
  it("chargement", () => expect(vues.chargement).toContain('aria-busy="true"'));
  it("erreur", () => expect(vues.erreur).toContain('role="alert"'));
  it("vouvoiement et mots interdits absents", () => {
    for (const html of Object.values(vues)) {
      const texte = html.replace(/<[^>]+>/g, " ");
      expect(motsInterditsEnvoi(texte)).toEqual([]);
      expect(texte).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i);
      expect(texte).not.toMatch(new RegExp(["cert", "ifi"].join(""), "i"));
      expect(texte).not.toContain(["Gren", "oble"].join(""));
      expect(texte).not.toContain(["Aucun gain", " garanti"].join(""));
    }
  });
});

describe("z3m · garde d'accès et contrat", () => {
  it("actions-migration.ts : toute fonction exportée commence par await exigerSession(, aucun lecteur injectable", () => {
    const source = readFileSync("src/app/(studio)/reglages/actions-migration.ts", "utf8");
    expect(source.trimStart().startsWith('"use server"')).toBe(true);
    const exportees = [...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)];
    expect(exportees.map((m) => m[1])).toEqual(["lireMigrationAction"]);
    expect(source).not.toMatch(/export\s+(?!async\s+function)(?!type\s)(?!interface\s)/);
    for (const m of exportees) {
      const corps = source.slice(m.index!).match(/export\s+async\s+function\s+\w+\s*\([^)]*\)[^{]*\{\s*(await exigerSession\()?/);
      expect(corps?.[1], `${m[1]} doit commencer par await exigerSession(`).toBeTruthy();
    }
  });
  it("aucune suppression vers Buffer dans les services de migration", () => {
    for (const f of ["src/components/migration/services.ts", "src/components/migration/FenetreLot.tsx", "src/app/(studio)/reglages/actions-migration.ts", "src/services/lecteur-migration.ts"]) {
      const source = readFileSync(f, "utf8").split("\n").filter((l) => !/^\s*(\/\/|\/?\*)/.test(l)).join("\n");
      expect(source, f).not.toMatch(/method\s*:\s*["']DELETE["']/i);
      expect(source, f).not.toMatch(/\.delete\s*\(|\bsupprimer\w*\s*\(|\bdelete\w*\s*\(/i);
    }
  });
  it("plafond d'ids par appel : rien n'est transmis au-delà", async () => {
    const retirer = vi.fn(async () => ({ ok: true as const, message: "" }));
    const s: ServiceImport = { ...serviceNonBranche, disponible: true, retirerDeBufferEtProgrammer: retirer };
    const ids = Array.from({ length: PLAFOND_IDS_PAR_APPEL + 1 }, (_, i) => `p${i}`);
    const r = await confirmerRetraitEtProgrammation(s, ids, [post("p0", "a-verifier", "linkedin", "2026-11-12T10:00:00Z", true)], MAINT);
    expect(r.resultat.ok).toBe(false);
    expect(retirer).not.toHaveBeenCalled();
  });
  it("accord du pluriel : « 1 post », « 2 posts »", () => {
    const un = renderToStaticMarkup(<FenetreLot titre="Lot B" posts={[post("c", "a-verifier")]} comparaisons={[]} service={serviceNonBranche} maintenant={MAINT} onFermer={() => {}} />);
    expect(un).toContain("Lot B · 1 post<");
    const deux = renderToStaticMarkup(<FenetreLot titre="Lot B" posts={[post("c", "a-verifier"), post("e", "a-verifier")]} comparaisons={[]} service={serviceNonBranche} maintenant={MAINT} onFermer={() => {}} />);
    expect(deux).toContain("Lot B · 2 posts<");
  });
});
