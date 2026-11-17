/**
 * FIX-ECRAN-SCENES-COMPLET : « Ce que chaque fichier dira et écrira », page de fin comprise. Lecture seule : la
 * première sortie en entier, les autres seulement par leurs différences (ou « Identique au fichier … »).
 */
import { Pastille } from "@/components/ui/Pastille";
import type { ApercuSortie } from "@/moteurs/montage-tableau/apercu-sorties";

const phrasesDe = (t: string) => t.split(/(?<=[.!?…])\s+/u).map((p) => p.trim()).filter(Boolean);
const cles = (a: ApercuSortie) => a.pages.flatMap((p) => p.lignes.map((l) => `${p.numero}|${l.texte}`));

function Ligne({ texte, ajout }: { texte: string; ajout: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-2 text-[15px] text-texte">
      <span>{texte}</span>
      {ajout && (
        <Pastille ton="ambre" icone="attention">
          Ajouté par le Studio
        </Pastille>
      )}
    </li>
  );
}

function Entier({ a }: { a: ApercuSortie }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-texte-doux">
        <span className="font-semibold">La voix dit :</span> {a.dit}
      </p>
      {a.pages.map((p) => (
        <div key={p.numero} className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-texte-faible">Page {p.numero} :</p>
          <ul className="space-y-1">
            {p.lignes.map((l, i) => (
              <Ligne key={i} texte={l.texte} ajout={l.ajout} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Difference({ a, premiere }: { a: ApercuSortie; premiere: ApercuSortie }) {
  const mienne = phrasesDe(a.dit);
  const sienne = phrasesDe(premiere.dit);
  const enPlus = mienne.filter((p) => !sienne.includes(p));
  const enMoins = sienne.filter((p) => !mienne.includes(p));
  const k1 = new Set(cles(premiere));
  const k2 = new Set(cles(a));
  const lignesEnPlus = a.pages.flatMap((p) => p.lignes.filter((l) => !k1.has(`${p.numero}|${l.texte}`)).map((l) => ({ ...l, page: p.numero })));
  const lignesEnMoins = premiere.pages.flatMap((p) => p.lignes.filter((l) => !k2.has(`${p.numero}|${l.texte}`)).map((l) => ({ ...l, page: p.numero })));
  if (!enPlus.length && !enMoins.length && !lignesEnPlus.length && !lignesEnMoins.length) return <p className="text-sm text-texte-doux">Identique au fichier {premiere.libelle}.</p>;
  return (
    <ul className="space-y-1 text-[15px] text-texte">
      {enPlus.map((p, i) => (
        <li key={`dp${i}`}>La voix dit en plus : {p}</li>
      ))}
      {enMoins.map((p, i) => (
        <li key={`dm${i}`}>La voix ne dit pas : {p}</li>
      ))}
      {lignesEnPlus.map((l, i) => (
        <li key={`lp${i}`} className="flex flex-wrap items-center gap-2">
          <span>
            Page {l.page}, écrit en plus : {l.texte}
          </span>
          {l.ajout && (
            <Pastille ton="ambre" icone="attention">
              Ajouté par le Studio
            </Pastille>
          )}
        </li>
      ))}
      {lignesEnMoins.map((l, i) => (
        <li key={`lm${i}`}>
          Page {l.page}, non écrit : {l.texte}
        </li>
      ))}
    </ul>
  );
}

export function ApercuSorties({ apercu }: { apercu: readonly ApercuSortie[] }) {
  if (!apercu.length) return null;
  const [premiere, ...autres] = apercu;
  const ajoutees = apercu.flatMap((a) => a.phrasesAjoutees.map((p) => ({ p, libelle: a.libelle })));
  return (
    <section aria-label="Ce que chaque fichier dira et écrira" className="space-y-4">
      <p className="font-titre text-2xl text-texte">Ce que chaque fichier dira et écrira</p>
      {ajoutees.length > 0 && (
        <ul className="space-y-1 rounded-2xl border border-trait bg-surface-1 px-4 py-3">
          {ajoutees.map((x, i) => (
            <li key={i} className="text-[15px] font-semibold text-texte">
              {x.p} <span className="font-normal text-texte-doux">({x.libelle}, ajoutée par le Studio)</span>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2 rounded-2xl border border-trait bg-surface-1 px-4 py-3">
        <p className="text-[15px] font-semibold text-texte">{premiere.libelle}</p>
        <Entier a={premiere} />
      </div>
      {autres.map((a) => (
        <div key={a.sortie} className="space-y-2 rounded-2xl border border-trait bg-surface-1 px-4 py-3">
          <p className="text-[15px] font-semibold text-texte">{a.libelle}</p>
          <Difference a={a} premiere={premiere} />
        </div>
      ))}
    </section>
  );
}
