// Notion API direct
'use strict';

// ── Hardcoded sample data (temporary — pending proper Notion OAuth connection) ──

const ORGS = [
  {
    id:          'org-pallialiege',
    name:        'PalliaLiège asbl',
    type:        'Soins palliatifs',
    pilier:      'Soins primaires',
    zone:        'Zone 08',
    etp:         7.6,
    financement: '',
    desc:        ''
  },
  {
    id:          'org-hospisoc',
    name:        'Hospisoc asbl',
    type:        'Association professionnelle',
    pilier:      'Action sociale',
    zone:        'Wallonie',
    etp:         0.5,
    financement: '',
    desc:        ''
  }
];

const MEMBRES = [
  {
    id:     'membre-ludovic',
    nom:    'Ludovic Perpete',
    role:   'Coordinateur',
    email:  'ludovic@hospisoc.be',
    tel:    '',
    photo:  null,
    orgId:  'org-hospisoc',
    statut: ''
  },
  {
    id:     'membre-nathalie',
    nom:    'Nathalie Legaye',
    role:   '',
    email:  '',
    tel:    '',
    photo:  null,
    orgId:  'org-pallialiege',
    statut: ''
  }
];

const LIENS = [];

// ── Handler ────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    'Content-Type':                 'application/json',
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const type = (event.queryStringParameters || {}).type;

  if (type === 'orgs')    return { statusCode: 200, headers, body: JSON.stringify(ORGS) };
  if (type === 'membres') return { statusCode: 200, headers, body: JSON.stringify(MEMBRES) };
  if (type === 'liens')   return { statusCode: 200, headers, body: JSON.stringify(LIENS) };

  return {
    statusCode: 400,
    headers,
    body: JSON.stringify({ error: `Unknown type "${type}". Expected: orgs, membres, liens` })
  };
};
