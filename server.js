const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;
const NOTION_VERSION = "2022-06-28";
const DB_IDS = {
  membres: "d3f693e5072c42dab660c132d3eafd97",
  organisations: "deae78249795400582c4337938eb06ee",
  liens: "c77e663666ba40baa3520c976d84d97c"
};
function prop(properties, name, type) {
  const p = properties[name];
  if (!p) return null;
  switch (type) {
    case "title": return p.title?.map(t => t.plain_text).join("") || null;
    case "rich_text": return p.rich_text?.map(t => t.plain_text).join("") || null;
    case "email": return p.email || null;
    case "phone_number": return p.phone_number || null;
    case "select": return p.select?.name || null;
    case "multi_select": return p.multi_select?.map(s => s.name) || [];
    case "number": return p.number ?? null;
    case "files": return p.files?.[0]?.file?.url || p.files?.[0]?.external?.url || null;
    case "relation": return p.relation?.map(r => r.id) || [];
    case "url": return p.url || null;
    default: return null;
  }
}
async function queryDB(id, token) {
  const results = [];
  let cursor = undefined;
  do {
    const body = cursor ? { start_cursor: cursor } : {};
    const resp = await fetch("https://api.notion.com/v1/databases/" + id + "/query", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error("NOTION ERROR", resp.status, text);
      throw new Error("Notion API error " + resp.status + ": " + text);
    }
    const data = await resp.json();
    results.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}
function mapMembre(page) {
  const p = page.properties;
  return {
    id: page.id,
    nom: prop(p, "Nom", "title"),
    fonction: prop(p, "Fonction", "rich_text"),
    email: prop(p, "Email", "email"),
    telephone: prop(p, "Téléphone", "phone_number"),
    photo: prop(p, "Photo", "files"),
    organisationLiee: prop(p, "Organisation liée", "relation"),
    statut: prop(p, "Statut", "select")
  };
}
function mapOrganisation(page) {
  const p = page.properties;
  return {
    id: page.id,
    nom: prop(p, "Nom", "title"),
    typeDeStructure: prop(p, "Type de structure", "select"),
    pilier: prop(p, "Pilier", "select"),
    missions: prop(p, "Missions", "rich_text"),
    roleGouvernance: prop(p, "Role dans la gouvernance", "select"),
    typeParticipation: prop(p, "Type de participation", "select"),
    logo: prop(p, "Logo", "files"),
    emailDeContact: prop(p, "Email de contact", "email")
  };
}
function mapLien(page) {
  const p = page.properties;
  const extractId = (val) => {
    if (!val) return null;
    const match = val.match(/([a-f0-9-]{32,36})$/);
    return match ? match[1].replace(/-/g, "") : val.replace(/-/g, "");
  };
  const rawA = prop(p, "Membre A", "relation")?.[0] || null;
  const rawB = prop(p, "Membre B", "relation")?.[0] || null;
  return {
    id: page.id,
    nom: prop(p, "Nom", "title"),
    type: prop(p, "Type de lien", "select"),
    membreA: extractId(rawA),
    membreB: extractId(rawB)
  };
}
app.use(express.static(path.join(__dirname)));
app.get("/api/data", async (req, res) => {
  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ error: "NOTION_TOKEN not set" });
  try {
    const [rawMembres, rawOrgs, rawLiens] = await Promise.all([
      queryDB(DB_IDS.membres, token),
      queryDB(DB_IDS.organisations, token),
      queryDB(DB_IDS.liens, token)
    ]);
    res.json({
      members: rawMembres.map(mapMembre),
      organisations: rawOrgs.map(mapOrganisation),
      liens: rawLiens.map(mapLien)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
app.listen(PORT, () => console.log("Server running on port " + PORT));
