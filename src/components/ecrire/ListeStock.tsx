"use client";

import { useState } from "react";
import { filtrerStock, etatDe, reseauxDe, type EtatStock, type MessageStock } from "@/domaine/stock-messages";
import { RESEAUX_TAXONOMIE } from "@/domaine/taxonomie-contenu";
import type { IdReseau } from "@/domaine/types";

const ETATS: { valeur: EtatStock; libelle: string }[] = [
  { valeur: "en-stock", libelle: "En stock" },
  { valeur: "planifie", libelle: "Planifié" },
  { valeur: "publie", libelle: "Publié" },
];
const NOMS_RESEAUX: Record<IdReseau, string> = {
  linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", "youtube-shorts": "YouTube Shorts",
} as Record<IdReseau, string>;
const RESEAUX = RESEAUX_TAXONOMIE;
const nom = (r: IdReseau) => NOMS_RESEAUX[r] ?? r;

/** Stock de messages à faire passer : filtres par réseau, état et échéance. Liste distincte des idées et des scripts. */
export function ListeStock({ entrees }: { entrees: MessageStock[] }) {
  const [reseau, setReseau] = useState<IdReseau | "">("");
  const [etat, setEtat] = useState<EtatStock | "">("en-stock");
  const [avant, setAvant] = useState("");
  const liste = filtrerStock(entrees, { reseau: reseau || undefined, etat: etat || undefined, echeanceAvant: avant || undefined });
  return (
    <section aria-label="Stock de messages">
      <div className="flex flex-wrap gap-3">
        <label>
          Réseau{" "}
          <select value={reseau} onChange={(ev) => setReseau(ev.target.value as IdReseau | "")}>
            <option value="">Tous</option>
            {RESEAUX.map((r) => (
              <option key={r} value={r}>{nom(r)}</option>
            ))}
          </select>
        </label>
        <label>
          État{" "}
          <select value={etat} onChange={(ev) => setEtat(ev.target.value as EtatStock | "")}>
            <option value="">Tous</option>
            {ETATS.map((x) => (
              <option key={x.valeur} value={x.valeur}>{x.libelle}</option>
            ))}
          </select>
        </label>
        <label>
          Échéance avant le <input type="date" value={avant} onChange={(ev) => setAvant(ev.target.value)} />
        </label>
      </div>
      {liste.length === 0 ? (
        <p>Aucun message dans le stock pour ces critères.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {liste.map((m) => (
            <li key={m.id}>
              <p>{m.texte}</p>
              <p className="text-sm">
                {reseauxDe(m).map(nom).join(", ")} · priorité {m.priorite ?? "normale"}
                {m.echeance ? ` · à faire avant le ${m.echeance}` : ""} · {ETATS.find((x) => x.valeur === etatDe(m))?.libelle}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
