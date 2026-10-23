/**
 * RELIRE ET MODIFIER LE SCRIPT AVANT LA VIDÉO, GRANDE CHAÎNE (briques 4 et 5) : l'adaptateur PUR du générateur de
 * sujets vers l'écran commun (`domaine/relecture-script`). Importable côté client et côté serveur.
 *
 * - Un LOT = les versions par réseau relues ensemble (une seule pour « Fabriquer », les N pour « Fabriquer les N ») :
 *   le début et la fin de chaque réseau, le milieu commun UNE fois. Les identifiants des lignes ne dépendent que du code
 *   (stable) et du segment : l'empreinte du texte relu survit aux nouvelles versions créées par l'enregistrement.
 * - Une phrase modifiée est reprise mot pour mot et marquée `ecritPar: "will"` : elle passe ensuite au barème « will »
 *   des contrôles (`controlerSelonAuteurs`), les autres phrases restent au barème « machine ».
 */
import { controlerVersion, type EntreeControle, type ResultatVersion, type ViolationControle } from "@/domaine/controles-script";
import { phraseControle } from "@/domaine/controles-script/phrases";
import { differences, type LigneScript, type PastilleControle } from "@/domaine/relecture-script";
import { segmentRetenu } from "@/domaine/derivations-generateur";
import type { BlocScript, Id, ReseauDeclinaison, SegmentScript } from "@/domaine/types";

/** Une version du lot, telle que l'écran la relit. */
export interface VersionDuLot {
  varianteId: Id;
  /** Code stable (« 0042-AV-TT ») : sert aux identifiants des lignes. */
  code: string;
  reseau: ReseauDeclinaison;
  nomReseau: string;
  scriptId: Id;
  /** Blocs du corps commun (tous réseaux ; les segments facultatifs sont filtrés par réseau). */
  corpsScript: BlocScript[];
  /** Versions courantes qui partagent ce corps (≥ 2 : « Milieu commun »). */
  versionsSurLeCorps: number;
  segmentFacultatifRetenu: boolean;
  ouverture: BlocScript[];
  fin: BlocScript[];
  /** Texte écrit à l'écran pendant l'ouverture. */
  encadre?: string;
}

const idOuverture = (code: string, segmentId: Id) => `o:${code}:${segmentId}`;
const idCorps = (segmentId: Id) => `c:${segmentId}`;
const idFin = (code: string, segmentId: Id) => `f:${code}:${segmentId}`;

const parles = (blocs: BlocScript[]) => blocs.flatMap((b) => b.segments).filter((s) => s.texte.trim());
const corpsDe = (v: VersionDuLot) => v.corpsScript.map((b) => ({ ...b, segments: b.segments.filter((s) => segmentRetenu(s, v)) })).filter((b) => b.segments.length > 0);

/** Le script relu : début de chaque réseau, milieu (une fois par corps), fin de chaque réseau. */
export function lignesDuLot(lot: readonly VersionDuLot[]): LigneScript[] {
  const plusieurs = lot.length > 1;
  const sur = (partie: string, v: VersionDuLot) => (plusieurs ? `${partie} · ${v.nomReseau}` : partie);
  const lignes: LigneScript[] = [];
  for (const v of lot) {
    parles(v.ouverture).forEach((s, i) => {
      lignes.push({ id: idOuverture(v.code, s.id), dit: s.texte, groupe: sur("Début", v), ...(i === 0 && v.encadre?.trim() ? { ecrits: [{ texte: v.encadre, modifiable: true }] } : {}) });
    });
  }
  const corps = new Map<Id, VersionDuLot[]>();
  for (const v of lot) corps.set(v.scriptId, [...(corps.get(v.scriptId) ?? []), v]);
  const vus = new Set<Id>();
  for (const [, versions] of corps) {
    const commun = versions.length > 1 || versions[0].versionsSurLeCorps > 1;
    const groupe = corps.size > 1 ? `Milieu · ${versions.map((v) => v.nomReseau).join(", ")}` : commun ? "Milieu commun" : "Milieu";
    for (const s of parles(versions[0].corpsScript)) {
      if (vus.has(s.id) || !versions.some((v) => segmentRetenu(s, v))) continue;
      vus.add(s.id);
      lignes.push({ id: idCorps(s.id), dit: s.texte, groupe });
    }
  }
  for (const v of lot) for (const s of parles(v.fin)) lignes.push({ id: idFin(v.code, s.id), dit: s.texte, groupe: sur("Fin", v) });
  return lignes;
}

/** Ce qu'il faut enregistrer après la relecture : les corps changés (une fois) et les versions changées. */
export interface EnregistrementLot {
  scripts: { scriptId: Id; blocs: BlocScript[] }[];
  versions: { varianteId: Id; code: string; ouverture?: BlocScript[]; fin?: BlocScript[]; encadre?: string }[];
}

/**
 * Applique le script relu au lot. Les différences sont recalculées ICI (jamais reprises de l'écran) : renvoyer deux
 * fois le même texte n'enregistre rien la seconde fois. Une phrase vidée, ou des lignes qui ne sont plus celles du
 * script (il a changé entre-temps), sont refusées : rien n'est enregistré.
 */
export function appliquerAuLot(lot: readonly VersionDuLot[], relues: readonly LigneScript[]): ({ ok: true } & EnregistrementLot) | { ok: false; raisons: string[] } {
  const avant = lignesDuLot(lot);
  const ids = (l: readonly LigneScript[]) => l.map((x) => x.id).join("|");
  if (ids(avant) !== ids(relues)) return { ok: false, raisons: ["Le script a changé depuis l'ouverture : relisez-le à nouveau."] };
  const diffs = differences(avant, relues);
  if (diffs.some((d) => d.dit !== undefined && !d.dit.trim())) return { ok: false, raisons: ["Une phrase est vide : écrivez-la ou rétablissez-la."] };
  const dits = new Map(diffs.filter((d) => d.dit !== undefined).map((d) => [d.id, d.dit!.replace(/\s+/g, " ").trim()]));
  const remplacer = (blocs: BlocScript[], id: (s: SegmentScript) => string) => {
    let change = false;
    const suite = blocs.map((b) => ({
      ...b,
      segments: b.segments.map((s) => {
        const t = dits.get(id(s));
        if (t === undefined) return s;
        change = true;
        return { ...s, texte: t, ecritPar: "will" as const };
      }),
    }));
    return change ? suite : null;
  };
  const scripts: EnregistrementLot["scripts"] = [];
  for (const v of lot) {
    if (scripts.some((s) => s.scriptId === v.scriptId)) continue;
    const blocs = remplacer(v.corpsScript, (s) => idCorps(s.id));
    if (blocs) scripts.push({ scriptId: v.scriptId, blocs });
  }
  const versions: EnregistrementLot["versions"] = [];
  for (const v of lot) {
    const ouverture = remplacer(v.ouverture, (s) => idOuverture(v.code, s.id));
    const fin = remplacer(v.fin, (s) => idFin(v.code, s.id));
    const premiere = parles(v.ouverture)[0];
    const ecrit = premiere ? diffs.find((d) => d.id === idOuverture(v.code, premiere.id))?.ecrits?.[0] : null;
    const encadre = ecrit !== null && ecrit !== undefined ? ecrit.replace(/\s+/g, " ").trim() : undefined;
    if (ouverture || fin || encadre !== undefined) versions.push({ varianteId: v.varianteId, code: v.code, ...(ouverture ? { ouverture } : {}), ...(fin ? { fin } : {}), ...(encadre !== undefined ? { encadre } : {}) });
  }
  return { ok: true, scripts, versions };
}

/** Le lot une fois les modifications appliquées (pour contrôler le texte relu sans rien enregistrer). */
export function lotModifie(lot: readonly VersionDuLot[], e: EnregistrementLot): VersionDuLot[] {
  return lot.map((v) => {
    const s = e.scripts.find((x) => x.scriptId === v.scriptId);
    const x = e.versions.find((y) => y.varianteId === v.varianteId);
    return { ...v, corpsScript: s?.blocs ?? v.corpsScript, ouverture: x?.ouverture ?? v.ouverture, fin: x?.fin ?? v.fin, encadre: x?.encadre ?? v.encadre };
  });
}

/** Blocs assemblés d'une version du lot (ouverture, corps de SON réseau, fin). */
export function blocsDeVersionDuLot(v: VersionDuLot): { ouverture: BlocScript[]; corps: BlocScript[]; fin: BlocScript[] } {
  return { ouverture: v.ouverture, corps: corpsDe(v), fin: v.fin };
}

/**
 * Contrôles d'une version au BON barème, phrase par phrase : un contrôle qui porte sur une phrase de Will
 * (`ecritPar: "will"`) est lu au barème « will », sur une phrase de la machine au barème « machine ». Un contrôle du
 * texte entier (durée, structure…) est lu au barème « will » dès que Will a écrit au moins une phrase (le texte final
 * est le sien), au barème « machine » sinon. `controle` : `controlerVersion` par défaut (ou le recontrôle sur
 * l'horodatage réel, après la fabrication).
 */
export function controlerSelonAuteurs(e: EntreeControle, controle: (e: EntreeControle) => ResultatVersion = (x) => controlerVersion(x)): ResultatVersion {
  const segments = [...e.ouverture, ...e.corps, ...e.fin].flatMap((b) => b.segments);
  const deWill = new Set(segments.flatMap((s, i) => (s.ecritPar === "will" ? [i] : [])));
  const machine = controle({ ...e, auteur: "machine" });
  if (!deWill.size) return machine;
  const will = controle({ ...e, auteur: "will" });
  const violations = [
    ...machine.violations.filter((v) => v.segmentIndex !== undefined && !deWill.has(v.segmentIndex)),
    ...will.violations.filter((v) => v.segmentIndex === undefined || deWill.has(v.segmentIndex)),
  ];
  return { ...machine, violations, passe: !violations.some((v) => v.bloquant) };
}

/** Pastilles de l'écran pour une version du lot : chaque contrôle rattaché à sa ligne (ou au script entier). */
export function pastillesDeVersion(v: VersionDuLot, violations: readonly ViolationControle[], nommerReseau: boolean): PastilleControle[] {
  const { ouverture, corps, fin } = blocsDeVersionDuLot(v);
  const ids = [...ouverture.flatMap((b) => b.segments.map((s) => idOuverture(v.code, s.id))), ...corps.flatMap((b) => b.segments.map((s) => idCorps(s.id))), ...fin.flatMap((b) => b.segments.map((s) => idFin(v.code, s.id)))];
  return violations.map((x) => {
    const ligneId = x.segmentIndex !== undefined ? ids[x.segmentIndex] : undefined;
    const texte = phraseControle(x).replace(/(\d)\.(\d)/g, "$1,$2");
    return { niveau: x.niveau, texte: !ligneId && nommerReseau ? `${v.nomReseau} : ${texte}` : texte, code: x.controle, ...(ligneId ? { ligneId } : {}) };
  });
}

/**
 * Pastilles du lot entier, sans doublon (une phrase du milieu commun contrôlée sur chaque réseau). Un contrôle du texte
 * entier levé sur plusieurs réseaux n'apparaît qu'une fois, avec leurs noms (aucun nom s'il touche tout le lot).
 */
export function pastillesDuLot(parVersion: readonly { version: VersionDuLot; violations: readonly ViolationControle[] }[]): PastilleControle[] {
  const vues = new Set<string>();
  const res: PastilleControle[] = [];
  const globales = new Map<string, { pastille: PastilleControle; reseaux: string[] }>();
  for (const { version, violations } of parVersion) {
    for (const p of pastillesDeVersion(version, violations, false)) {
      if (!p.ligneId && parVersion.length > 1) {
        const k = `${p.niveau}|${p.code ?? ""}|${p.texte}`;
        const g = globales.get(k);
        if (g) g.reseaux.push(version.nomReseau);
        else {
          globales.set(k, { pastille: p, reseaux: [version.nomReseau] });
          res.push(p);
        }
        continue;
      }
      const k = `${p.ligneId ?? ""}|${p.code ?? ""}|${p.texte}`;
      if (vues.has(k)) continue;
      vues.add(k);
      res.push(p);
    }
  }
  return res.map((p) => {
    const g = [...globales.values()].find((x) => x.pastille === p);
    return g && g.reseaux.length < parVersion.length ? { ...p, texte: `${g.reseaux.join(", ")} : ${p.texte}` } : p;
  });
}
