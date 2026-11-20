/**
 * M7 · Contrôles finaux du cas concret : bloquants, indicatifs, phrases sans identifiant interne.
 * Aucune taille en pixels n'est figée ici : les écrans viennent des exemples de la brique.
 */
import { describe, expect, it } from "vitest";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import { recrutementApporteurs } from "@/formats/cas-concret/catalogue/recrutement-apporteurs";
import { controlerVideoCasConcret, type EntreeControleCasConcret, type MesuresFin } from "@/moteurs/montage-cas-concret/controles";
import type { FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { planDesFins } from "@/moteurs/montage-cas-concret/fins";
import { exemplesEcrans, ZONE_QUATRE_RESEAUX } from "../../../studio-rendu/compositions/cas-concret/exemples";
import { ficheVideo1 } from "../regles/outils";

const ZONE = { haut: ZONE_QUATRE_RESEAUX.haut / 100, droite: ZONE_QUATRE_RESEAUX.droite / 100, bas: ZONE_QUATRE_RESEAUX.bas / 100, gauche: ZONE_QUATRE_RESEAUX.gauche / 100 };
const base = { mot: recrutementApporteurs.mot, motDit: recrutementApporteurs.motDit, avecMot: true, motSur: ["facebook" as const, "instagram" as const], table: TABLE_FINS_DIAGNOSTIC };

/** Fiche de la vidéo 1 calée : 3 s par écran, accroche de 2,8 s. */
function ficheCalee(): FicheEcrans {
  const f = ficheVideo1();
  let t = 0;
  return { ...f, ecrans: f.ecrans.map((e, i) => { const d = i === 0 ? 2800 : 3000; const r = { ...e, debutMs: t, finMs: t + d }; t += d; return r; }) as FicheEcrans["ecrans"] };
}

const MESURES_BONNES: MesuresFin = { lufs: -14, creteVraieDbtp: -2, imageNoireTete: 0, dureeSec: 53, largeur: 1080, hauteur: 1920, fps: 25, voixFinSec: 50.9 };

function entree(sur: Partial<EntreeControleCasConcret> = {}): EntreeControleCasConcret {
  const plan = planDesFins({ ...base, reseaux: ["facebook"], offre: "integration", nature: "automatisation" });
  const fin = plan.fins[0];
  const finCalee = { ...plan, fins: [{ ...fin, ecrans: fin.ecrans.map((e, i, tous) => ({ ...e, debutMs: i * 3000, finMs: (i + 1) * 3000 + (i === tous.length - 1 ? 2100 : 0) })) }] };
  return {
    fiche: ficheCalee(),
    proprietes: { corps: exemplesEcrans(), fins: {} },
    mesuresParFin: { [fin.id]: MESURES_BONNES },
    journalCaptures: [],
    planDesFins: finCalee,
    bruitagesPoses: ["clic"],
    zone: ZONE,
    ...sur,
  };
}


describe("CC-SV · sans voix, la fin propre (image tenue) reste regardée", () => {
  const id = () => entree().planDesFins.fins[0].id;
  it("image qui bouge encore à la dernière image : la ligne « Fin propre » est là et échoue", () => {
    const e = entree({ sansVoix: true });
    const r = controlerVideoCasConcret({ ...e, mesuresParFin: { [id()]: { ...MESURES_BONNES, sonDerniere100msDb: -100, mouvementDerniereImage: 9 } } });
    const l = r.lignes.find((x) => x.libelle === "Fin propre");
    expect(l?.etat).toBe("echoue");
    expect(l?.raison).toMatch(/l'image bouge encore/);
  });
  it("image tenue et silence : la ligne « Fin propre » réussit ; volume, crête et fin de voix ne sont pas exigés", () => {
    const e = entree({ sansVoix: true });
    const r = controlerVideoCasConcret({ ...e, mesuresParFin: { [id()]: { ...MESURES_BONNES, lufs: -70, creteVraieDbtp: -90, voixFinSec: undefined, sonDerniere100msDb: -100, mouvementDerniereImage: 0 } } });
    expect(r.bloquants.map((l) => l.raison)).toEqual([]);
    const toutes = r.lignes;
    expect(toutes.find((x) => x.libelle === "Fin propre")?.etat).toBe("reussi");
    expect(toutes.some((x) => x.libelle === "Volume du son" || x.libelle === "Fin de la voix")).toBe(false);
  });
});
