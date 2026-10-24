
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

let prisma;
function getDB() {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

const JWT_SECRET = process.env.JWT_SECRET || 'BestRent_JWT_2026';

function json(code, body) {
  return {
    statusCode: code,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

function parseBody(event) {
  try { return JSON.parse(event.body || '{}'); } catch (e) { return {}; }
}

function verifyAuth(event) {
  var auth = event.headers.authorization || event.headers.Authorization || '';
  var token = auth.replace('Bearer ', '');
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch (e) { return null; }
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(200, {});

  var db = getDB();
  var path = event.path.replace('/.netlify/functions/api', '').replace('/api', '') || '/';
  var method = event.httpMethod;
  var segments = path.split('/').filter(Boolean);
  var resource = segments[0];
  var id = segments[1] ? parseInt(segments[1]) : null;
  var action = segments[2] || null;
  var query = event.queryStringParameters || {};

  try {

    // HEALTH
    if (resource === 'health') {
      return json(200, { status: 'online', timestamp: new Date().toISOString() });
    }

    // AUTH LOGIN
    if (resource === 'auth' && segments[1] === 'login' && method === 'POST') {
      var body = parseBody(event);
      if (!body.username || !body.password) return json(400, { error: 'Username e password obbligatori' });
      var operatore = await db.operatore.findUnique({ where: { username: body.username } });
      if (!operatore || !operatore.attivo) return json(401, { error: 'Credenziali non valide' });
      if (!operatore.password_hash) {
        var newHash = await bcrypt.hash(body.password, 12);
        await db.operatore.update({ where: { id: operatore.id }, data: { password_hash: newHash } });
      } else {
        var valid = await bcrypt.compare(body.password, operatore.password_hash);
        if (!valid) return json(401, { error: 'Credenziali non valide' });
      }
      var token = jwt.sign({ id: operatore.id, username: operatore.username, ruolo: operatore.ruolo, nome: operatore.cognome_nome }, JWT_SECRET, { expiresIn: '24h' });
      return json(200, { token: token, operatore: { id: operatore.id, nome: operatore.cognome_nome, ruolo: operatore.ruolo } });
    }

    // AUTH ME
    if (resource === 'auth' && segments[1] === 'me' && method === 'GET') {
      var user = verifyAuth(event);
      if (!user) return json(401, { error: 'Non autenticato' });
      var op = await db.operatore.findUnique({ where: { id: user.id }, select: { id: true, cognome_nome: true, ruolo: true, email: true } });
      return json(200, op);
    }

    // DASHBOARD
    if (resource === 'dashboard' && method === 'GET') {
      var user = verifyAuth(event);
      if (!user) return json(401, { error: 'Non autenticato' });
      var contrattiAttivi = await db.contratto.count({ where: { stato_contratto: 'attivo' } });
      var totaleClienti = await db.cliente.count();
      var totaleVeicoli = await db.veicolo.count();
      var fatturato = await db.contratto.aggregate({ _sum: { totale_documento: true } });
      var ultimiContratti = await db.contratto.findMany({
        take: 10,
        orderBy: { created_at: 'desc' },
        include: { cliente: { select: { cognome_nome: true } }, veicolo: { select: { marca: true, modello: true, targa: true } } }
      });
      return json(200, {
        kpi: { contrattiAttivi: contrattiAttivi, totaleClienti: totaleClienti, totaleVeicoli: totaleVeicoli, fatturato: fatturato._sum.totale_documento || 0 },
        ultimiContratti: ultimiContratti
      });
    }

    // CLIENTI
    if (resource === 'clienti') {
      var user = verifyAuth(event);
      if (!user) return json(401, { error: 'Non autenticato' });

      if (method === 'GET' && !id) {
        var page = parseInt(query.page) || 1;
        var limit = parseInt(query.limit) || 20;
        var where = {};
        if (query.search) {
          where.OR = [
            { cognome_nome: { contains: query.search } },
            { telefono: { contains: query.search } },
            { patente_nr: { contains: query.search } }
          ];
        }
        var dati = await db.cliente.findMany({ where: where, skip: (page - 1) * limit, take: limit, orderBy: { cognome_nome: 'asc' } });
        var totale = await db.cliente.count({ where: where });
        return json(200, { dati: dati, paginazione: { pagina: page, totale: totale } });
      }
      if (method === 'GET' && id) {
        var cliente = await db.cliente.findUnique({ where: { id: id }, include: { contratti: true } });
        if (!cliente) return json(404, { error: 'Cliente non trovato' });
        return json(200, cliente);
      }
      if (method === 'POST') {
        var data = parseBody(event);
        var cliente = await db.cliente.create({ data: data });
        return json(201, cliente);
      }
      if (method === 'PUT' && id) {
        var data = parseBody(event);
        delete data.id;
        var cliente = await db.cliente.update({ where: { id: id }, data: data });
        return json(200, cliente);
      }
      if (method === 'DELETE' && id) {
        await db.cliente.delete({ where: { id: id } });
        return json(200, { messaggio: 'Cliente eliminato' });
      }
    }

    // VEICOLI
    if (resource === 'veicoli') {
      var user = verifyAuth(event);
      if (!user) return json(401, { error: 'Non autenticato' });

      if (method === 'GET' && !id) {
        var where = {};
        if (query.stato) where.stato = query.stato;
        if (query.search) {
          where.OR = [
            { targa: { contains: query.search } },
            { marca: { contains: query.search } },
            { modello: { contains: query.search } }
          ];
        }
        var veicoli = await db.veicolo.findMany({ where: where, orderBy: { targa: 'asc' } });
        return json(200, veicoli);
      }
      if (method === 'GET' && id) {
        var veicolo = await db.veicolo.findUnique({ where: { id: id }, include: { contratti: true } });
        if (!veicolo) return json(404, { error: 'Veicolo non trovato' });
        return json(200, veicolo);
      }
      if (method === 'POST') {
        var data = parseBody(event);
        var veicolo = await db.veicolo.create({ data: data });
        return json(201, veicolo);
      }
      if (method === 'PUT' && id) {
        var data = parseBody(event);
        delete data.id;
        var veicolo = await db.veicolo.update({ where: { id: id }, data: data });
        return json(200, veicolo);
      }
      if (method === 'DELETE' && id) {
        await db.veicolo.delete({ where: { id: id } });
        return json(200, { messaggio: 'Veicolo eliminato' });
      }
    }

    // CONTRATTI
    if (resource === 'contratti') {
      var user = verifyAuth(event);
      if (!user) return json(401, { error: 'Non autenticato' });

      if (method === 'GET' && !id) {
        var where = {};
        if (query.stato) where.stato_contratto = query.stato;
        if (query.search) {
          where.OR = [
            { numero_contratto: { contains: query.search } }
          ];
        }
        var dati = await db.contratto.findMany({
          where: where,
          orderBy: { data_consegna: 'desc' },
          include: { cliente: { select: { cognome_nome: true } }, veicolo: { select: { marca: true, modello: true, targa: true } } }
        });
        return json(200, { dati: dati });
      }
      if (method === 'GET' && id) {
        var contratto = await db.contratto.findUnique({
          where: { id: id },
          include: { cliente: true, veicolo: true, pagamenti: true, ispezioni: true, dotazioni: true }
        });
        if (!contratto) return json(404, { error: 'Contratto non trovato' });
        return json(200, contratto);
      }
      if (method === 'POST') {
        var data = parseBody(event);
        if (data.data_consegna) data.data_consegna = new Date(data.data_consegna);
        if (data.data_rientro_prevista) data.data_rientro_prevista = new Date(data.data_rientro_prevista);
        var contratto = await db.contratto.create({ data: data });
        return json(201, contratto);
      }
      if (method === 'PATCH' && id && action === 'checkin') {
        var data = parseBody(event);
        var contratto = await db.contratto.update({
          where: { id: id },
          data: { data_rientro_effettiva: new Date(), km_rientro: data.km_rientro, gas_rientro: data.gas_rientro, stato_contratto: 'chiuso' }
        });
        await db.veicolo.update({ where: { id: contratto.id_veicolo }, data: { stato: 'disponibile' } });
        return json(200, { messaggio: 'Check-in completato' });
      }
    }

    // PAGAMENTI
    if (resource === 'pagamenti') {
      var user = verifyAuth(event);
      if (!user) return json(401, { error: 'Non autenticato' });

      if (method === 'GET') {
        var where = {};
        if (query.id_contratto) where.id_contratto = parseInt(query.id_contratto);
        var pagamenti = await db.pagamento.findMany({ where: where, orderBy: { data_pagamento: 'desc' } });
        return json(200, pagamenti);
      }
      if (method === 'POST') {
        var data = parseBody(event);
        var pagamento = await db.pagamento.create({ data: data });
        return json(201, pagamento);
      }
    }

    // PENALI
    if (resource === 'penali' && method === 'GET') {
      var penali = await db.penale.findMany({ where: { attivo: true } });
      return json(200, penali);
    }

    return json(404, { error: 'Endpoint non trovato', path: path });

  } catch (err) {
    console.error('Errore API:', err);
    return json(500, { error: 'Errore interno', dettaglio: err.message });
  }
};

