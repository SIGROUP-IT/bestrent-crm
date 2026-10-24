const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const hash = await bcrypt.hash('BestRent2026!', 12);

  const op = await prisma.operatore.create({
    data: {
      cognome_nome: 'Gaetano T.',
      ruolo: 'admin',
      username: 'gaetano.t',
      password_hash: hash,
      email: 'noleggibestrent@gmail.com'
    }
  });
  console.log('Operatore creato');

  const cl = await prisma.cliente.create({
    data: {
      cognome_nome: 'Jandar Baker',
      nazione: 'Svizzera',
      telefono: '049-17680553896',
      patente_nr: '0030324HJ62'
    }
  });
  console.log('Cliente creato');

  const ve = await prisma.veicolo.create({
    data: {
      targa: 'GA398HG',
      marca: 'Mitsubishi',
      modello: 'Space Star',
      km_attuali: 148000,
      stato: 'noleggiato'
    }
  });
  console.log('Veicolo creato');

  const co = await prisma.contratto.create({
    data: {
      numero_contratto: 'M165',
      id_cliente: cl.id,
      id_veicolo: ve.id,
      data_consegna: new Date('2026-10-14'),
      data_rientro_prevista: new Date('2026-10-18'),
      tariffa_giornaliera: 45.00,
      giorni_noleggio: 4,
      totale_documento: 171.00,
      stato_contratto: 'attivo'
    }
  });
  console.log('Contratto creato');

  await prisma.pagamento.create({
    data: {
      id_contratto: co.id,
      tipo_pagamento: 'bonifico',
      importo: 700.00,
      deposito_cauzionale: 700.00
    }
  });
  console.log('Pagamento registrato');

  console.log('Seed completato!');
}

main()
  .catch(function(e) { console.error('Errore:', e); process.exit(1); })
  .finally(function() { prisma.$disconnect(); });
