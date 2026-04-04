'use strict';
// deploy trigger

// ── Constants ──────────────────────────────────────────────────────────────
const NOTION_API_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

const DB_ORGS    = '26e8ec6c-0853-4ce4-96da-ad1d5ac25153';
const DB_MEMBRES = '6436e822-48be-475c-879e-d019f780c39c';
const DB_LIENS   = '9924620e-87e1-4d5b-89eb-206b582b253b';

// ── Property extractors ────────────────────────────────────────────────────
function getTitle(props) {
  for (const p of Object.values(props)) {
    if (p.type === 'title' && p.title?.length) {
      return p.title.map(t => t.plain_text).join('');
    }
  }
  return '';
}

function getText(props, ...keys) {
  for (const key of keys) {
    const p = props[key];
    if (!p) continue;
    if (p.type === 'rich_text'    && p.rich_text?.length)   return p.rich_text.map(t => t.plain_text).join('');
    if (p.type === 'select'       && p.select?.name)        return p.select.name;
    if (p.type === 'multi_select' && p.multi_select?.length) return p.multi_select.map(s => s.name).join(', ');
    if (p.type === 'email'        && p.email)               return p.email;
    if (p.type === 'phone_number' && p.phone_number)        return p.phone_number;
    if (p.type === 'url'          && p.url)                 return p.url;
  }
  return '';
}

function getNumber(props, ...keys) {
  for (const key of keys) {
    const p = props[key];
    if (p?.type === 'number' && p.number !== null) return p.number;
  }
  return 0;
}

function getRelationId(props, ...keys) {
  for (const key of keys) {
    const p = props[key];
    if (p?.type === 'relation' && p.relation?.length) return p.relation[0].id;
  }
  return null;
}

function getFileUrl(props, ...keys) {
  for (const key of keys) {
    const p = props[key];
    if (!p || p.type !== 'files' || !p.files?.length) continue;
    const f = p.files[0];
    if (f.type === 'external') return f.external.url;
    if (f.type === 'file')     return f.file.url;
  }
  return null;
}

// ── Notion query with pagination ───────────────────────────────────────────
async function queryDatabase(token, databaseId) {
  const pages = [];
  let cursor;

  do {
    const body = cursor ? { start_cursor: cursor } : {};
    const resp = await fetch(`${NOTION_API_URL}/databases/${databaseId}/query`, {
      method:  'POST',
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type':   'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `Notion API error: HTTP ${resp.status}`);
    }

    const data = await resp.json();
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return pages;
}

// ── Data mappers ───────────────────────────────────────────────────────────
function mapOrgs(pages) {
  return pages.map(page => {
    const p = page.properties;
    return {
      id:          page.id,
      name:        getTitle(p),
      type:        getText(p, "Type d'organisation", 'Type', 'type'),
      pilier:      getText(p, 'Pilier', 'pilier'),
      zone:        getText(p, 'Zone', 'Territoire', 'zone') || 'Liège',
      etp:         getNumber(p, 'ETP', 'etp'),
      financement: getText(p, 'Financement', 'financement'),
      desc:        getText(p, 'Description', 'desc')
    };
  });
}

function mapMembres(pages) {
  return pages.map(page => {
    const p = page.properties;
    return {
      id:     page.id,
      nom:    getTitle(p),
      role:   getText(p, 'Fonction', 'Rôle', 'Role', 'role'),
      email:  getText(p, 'Email', 'email'),
      tel:    getText(p, 'Téléphone', 'Telephone', 'tel'),
      photo:  getFileUrl(p, 'Photo', 'photo'),
      orgId:  getRelationId(p, 'Organisation liée', 'Organisation', 'org'),
      statut: getText(p, 'Statut', 'statut')
    };
  });
}

function mapLiens(pages) {
  return pages
    .map(page => {
      const p = page.properties;
      return {
        from: getRelationId(p, 'Membre 1', 'membre1', 'From'),
        to:   getRelationId(p, 'Membre 2', 'membre2', 'To'),
        type: getText(p, 'Type de lien', 'type', 'Type')
      };
    })
    .filter(l => l.from && l.to);
}

// ── Handler ────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const type = (event.queryStringParameters || {}).type;
  if (!['orgs', 'membres', 'liens'].includes(type)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Unknown type "${type}". Expected: orgs, membres, liens` })
    };
  }

  const token = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;
  if (!token) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'NOTION_TOKEN environment variable is not set' })
    };
  }

  try {
    let data;
    if (type === 'orgs') {
      data = mapOrgs(await queryDatabase(token, DB_ORGS));
    } else if (type === 'membres') {
      data = mapMembres(await queryDatabase(token, DB_MEMBRES));
    } else {
      data = mapLiens(await queryDatabase(token, DB_LIENS));
    }
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    console.error(`[getData] type=${type} error:`, err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
