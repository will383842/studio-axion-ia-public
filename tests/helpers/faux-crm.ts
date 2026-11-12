/** Faux CRM en mémoire : un `fetch` de remplacement, données fictives (@exemple.fr), aucun réseau. */
export type ContactFictif = { email: string };

export function creerFauxCrm() {
  const contacts: ContactFictif[] = [];
  const appels: { methode: string; url: string }[] = [];
  const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { "content-type": "application/json" } });

  const fetchFaux = async (entree: unknown, init?: { method?: string; body?: unknown }): Promise<Response> => {
    const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : String((entree as { url?: string }).url);
    const methode = (init?.method ?? "GET").toUpperCase();
    appels.push({ methode, url });
    if (methode === "GET") return json(contacts);
    if (methode === "POST") {
      const contact = JSON.parse(String(init?.body ?? "{}")) as ContactFictif;
      if (!/^[^@\s]+@exemple\.fr$/.test(contact.email ?? "")) return json({ erreur: "adresse fictive @exemple.fr attendue" }, 422);
      contacts.push(contact);
      return json(contact, 201);
    }
    return json({ erreur: "méthode non prévue" }, 405);
  };

  return { fetch: fetchFaux as typeof fetch, contacts, appels };
}
