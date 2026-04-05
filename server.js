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
    const resp = await fetch(`https://api.notion.com/v1/databases/${id}/query`, {
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
      throw new Error(`Notion API error ${resp.status}: ${text}`);
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
    organisationLiee: prop(p, "Organisation liée"

cat > Dockerfile << 'EOF'
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
