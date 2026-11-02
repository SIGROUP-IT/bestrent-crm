
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
function json(code, data) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS' }, body: JSON.stringify(data) };
}
exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  try {
    var method = event.httpMethod;
    var path = event.path.replace('/.netlify/functions/api', '').replace(/^\/+/, '');
    var segments = path.split('/').filter(Boolean);
    var resource = segments[0] || '';
    var id = segments[1] ? parseInt(segments[1]) : null;
    var body = null;
    if (event.body) { try { body = JSON.parse(event.body); } catch(e) { body = {}; } }
    // AUTH
    if (resource === 'auth' && segments[1] === 'login' && method === 'POST') {
      if (!body || !body.username || !body.password) return json(400, { error: 'Username e password obbligatori' });
      var op = await db.operatore.findUnique({ where: { username: body.username } });
      if (!op) return json(401, { error: 'Credenziali non valide' });
      if (op.password_hash !== body.password) return json(401, { error: 'Password errata' });
      return json(200, { token: Buffer.from(op.username + ':' + Date.now()).toString('base64'), operatore: { id: op.id, nome: op.nome, username: op.username, ruolo: op.ruolo, email: op.email } });
    }
    // CLIENTI
    if (resource === 'clienti') {
      if (method === 'GET' && !id) { var clienti = await db.cliente.findMany({ include: { contratti: { include: { veicolo: true } } }, orderBy: { id: 'desc' } }); return json(200, { dati: clienti }); }
      if (method === 'GET' && id) { var cliente = await db.cliente.findUnique({ where: { id: id }, include: { contratti: { include: { veicolo: true } } } }); if (!cliente) return json(404, { error: 'Cliente non trovato' }); return json(200, cliente); }
      if (method === 'POST') {
        if (!body || !body.cognome_nome) return json(400, { error: 'Nome obbligatorio' });
        var dc = { cognome_nome: body.cognome_nome, telefono: body.telefono || null, email: body.email || null, patente_nr: body.patente_nr || null, nazione: body.nazione || null, codice_fiscale_piva: body.codice_fiscale_piva || null, indirizzo: body.indirizzo || null };
        if (body.patente_valida_al) dc.patente_valida_al = new Date(body.patente_valida_al);
        return json(201, await db.cliente.create({ data: dc }));
      }
      if (method === 'PUT' && id) {
        var uc = {};
        if (body.cognome_nome) uc.cognome_nome = body.cognome_nome;
        if (body.telefono !== undefined) uc.telefono = body.telefono;
        if (body.email !== undefined) uc.email = body.email;
        if (body.patente_nr !== undefined) uc.patente_nr = body.patente_nr;
        if (body.nazione !== undefined) uc.nazione = body.nazione;
        if (body.indirizzo !== undefined) uc.indirizzo = body.indirizzo;
        if (body.codice_fiscale_piva !== undefined) uc.codice_fiscale_piva = body.codice_fiscale_piva;
        return json(200, await db.cliente.update({ where: { id: id }, data: uc }));
      }
      if (method === 'DELETE' && id) { await db.cliente.delete({ where: { id: id } }); return json(200, { ok: true }); }
    }
    // VEICOLI
    if (resource === 'veicoli') {
      if (method === 'GET' && !id) { var veicoli = await db.veicolo.findMany({ orderBy: { id: 'desc' } }); return json(200, { dati: veicoli }); }
      if (method === 'GET' && id) { var veicolo = await db.veicolo.findUnique({ where: { id: id }, include: { contratti: true } }); if (!veicolo) return json(404, { error: 'Veicolo non trovato' }); return json(200, veicolo); }
      if (method === 'POST') {
        if (!body || !body.targa) return json(400, { error: 'Targa obbligatoria' });
        return json(201, await db.veicolo.create({ data: { targa: body.targa, marca: body.marca || '', modello: body.modello || '', colore: body.colore || null, km_attuali: body.km_attuali || 0, tipo_carburante: body.tipo_carburante || null, sede: body.sede || null, stato: body.stato || 'disponibile' } }));
      }
      if (method === 'PUT' && id) {
        var uv = {};
        if (body.targa) uv.targa = body.targa;
        if (body.marca) uv.marca = body.marca;
        if (body.modello) uv.modello = body.modello;
        if (body.colore !== undefined) uv.colore = body.colore;
        if (body.km_attuali !== undefined) uv.km_attuali = parseInt(body.km_attuali);
        if (body.stato) uv.stato = body.stato;
        if (body.sede) uv.sede = body.sede;
        return json(200, await db.veicolo.update({ where: { id: id }, data: uv }));
      }
      if (method === 'DELETE' && id) { await db.veicolo.delete({ where: { id: id } }); return json(200, { ok: true }); }
    }
    // CONTRATTI
    if (resource === 'contratti') {
      if (method === 'GET' && !id) { var contratti = await db.contratto.findMany({ include: { cliente: true, veicolo: true }, orderBy: { id: 'desc' } }); return json(200, { dati: contratti }); }
      if (method === 'GET' && id) { var contratto = await db.contratto.findUnique({ where: { id: id }, include: { cliente: true, veicolo: true, pagamenti: true } }); if (!contratto) return json(404, { error: 'Contratto non trovato' }); return json(200, contratto); }
      if (method === 'POST') {
        if (!body || !body.numero_contratto) return json(400, { error: 'Numero contratto obbligatorio' });
        return json(201, await db.contratto.create({ data: { numero_contratto: body.numero_contratto, id_cliente: parseInt(body.id_cliente), id_veicolo: parseInt(body.id_veicolo), sede_noleggio: body.sede_noleggio || 'Gallarate MXP', data_consegna: body.data_consegna ? new Date(body.data_consegna) : new Date(), data_rientro_prevista: body.data_rientro_prevista ? new Date(body.data_rientro_prevista) : new Date(), tariffa_giornaliera: body.tariffa_giornaliera ? parseFloat(body.tariffa_giornaliera) : 45, giorni_noleggio: body.giorni_noleggio ? parseInt(body.giorni_noleggio) : 1, sconto_percentuale: body.sconto_percentuale ? parseFloat(body.sconto_percentuale) : 0, totale_documento: body.totale_documento ? parseFloat(body.totale_documento) : 0, deposito_cauzionale: body.deposito_cauzionale ? parseFloat(body.deposito_cauzionale) : 0, note: body.note || null, stato_contratto: 'attivo' } }));
      }
      if (method === 'PUT' && id) {
        var uct = {};
        if (body.stato_contratto) uct.stato_contratto = body.stato_contratto;
        if (body.data_rientro_effettiva) uct.data_rientro_effettiva = new Date(body.data_rientro_effettiva);
        if (body.km_rientro) uct.km_rientro = parseInt(body.km_rientro);
        if (body.note !== undefined) uct.note = body.note;
        if (body.tariffa_giornaliera) uct.tariffa_giornaliera = parseFloat(body.tariffa_giornaliera);
        if (body.giorni_noleggio) uct.giorni_noleggio = parseInt(body.giorni_noleggio);
        if (body.totale_documento) uct.totale_documento = parseFloat(body.totale_documento);
        return json(200, await db.contratto.update({ where: { id: id }, data: uct }));
      }
      if (method === 'DELETE' && id) { await db.pagamento.deleteMany({ where: { id_contratto: id } }); await db.contratto.delete({ where: { id: id } }); return json(200, { ok: true }); }
    }
    // PAGAMENTI
    if (resource === 'pagamenti') {
      if (method === 'GET' && !id) { var pagamenti = await db.pagamento.findMany({ include: { contratto: { include: { cliente: true } } }, orderBy: { id: 'desc' } }); return json(200, { dati: pagamenti }); }
      if (method === 'GET' && id) { var pagamento = await db.pagamento.findUnique({ where: { id: id }, include: { contratto: true } }); if (!pagamento) return json(404, { error: 'Pagamento non trovato' }); return json(200, pagamento); }
      if (method === 'POST') {
        if (!body || !body.id_contratto) return json(400, { error: 'ID contratto obbligatorio' });
        return json(201, await db.pagamento.create({ data: { id_contratto: parseInt(body.id_contratto), tipo_pagamento: body.tipo_pagamento || 'contanti', importo: body.importo ? parseFloat(body.importo) : 0, deposito_cauzionale: body.deposito_cauzionale ? parseFloat(body.deposito_cauzionale) : 0, rimborsato: body.rimborsato || false, data_pagamento: body.data_pagamento ? new Date(body.data_pagamento) : new Date() } }));
      }
      if (method === 'DELETE' && id) { await db.pagamento.delete({ where: { id: id } }); return json(200, { ok: true }); }
    }
    // PENALI
    if (resource === 'penali') {
      if (method === 'GET') { var penali = await db.penale.findMany({ orderBy: { id: 'asc' } }); return json(200, { dati: penali }); }
    }
    // OPERATORI
    if (resource === 'operatori') {
      if (method === 'GET' && !id) { var operatori = await db.operatore.findMany({ select: { id: true, nome: true, username: true, ruolo: true, email: true, attivo: true }, orderBy: { id: 'asc' } }); return json(200, { dati: operatori }); }
      if (method === 'GET' && id) { var operatore = await db.operatore.findUnique({ where: { id: id }, select: { id: true, nome: true, username: true, ruolo: true, email: true, attivo: true } }); if (!operatore) return json(404, { error: 'Operatore non trovato' }); return json(200, operatore); }
      if (method === 'POST') {
        if (!body || !body.nome || !body.username || !body.password) return json(400, { error: 'Nome, username e password obbligatori' });
        var esiste = await db.operatore.findUnique({ where: { username: body.username } });
        if (esiste) return json(409, { error: 'Username gia in uso' });
        var nop = await db.operatore.create({ data: { nome: body.nome, username: body.username, password_hash: body.password, email: body.email || null, ruolo: body.ruolo || 'operatore', attivo: true } });
        return json(201, { id: nop.id, nome: nop.nome, username: nop.username, ruolo: nop.ruolo });
      }
      if (method === 'PUT' && id) {
        var uo = {};
        if (body.nome) uo.nome = body.nome;
        if (body.email !== undefined) uo.email = body.email;
        if (body.ruolo) uo.ruolo = body.ruolo;
        if (body.password) uo.password_hash = body.password;
        if (body.attivo !== undefined) uo.attivo = body.attivo;
        var opAgg = await db.operatore.update({ where: { id: id }, data: uo });
        return json(200, { id: opAgg.id, nome: opAgg.nome, username: opAgg.username, ruolo: opAgg.ruolo });
      }
      if (method === 'DELETE' && id) { await db.operatore.delete({ where: { id: id } }); return json(200, { ok: true }); }
    }
    return json(404, { error: 'Endpoint non trovato', path: path, method: method });
  } catch (err) {
    console.error('Errore API:', err);
    return json(500, { error: 'Errore interno', dettaglio: err.message });
  }
};
