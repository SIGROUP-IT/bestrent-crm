const{PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
db.operatore.update({
  where:{username:'gaetano.t'},
  data:{password_hash:'BestRent2026!'}
}).then(function(r){
  console.log('Password aggiornata per: '+r.username);
}).catch(function(e){
  console.log('ERRORE:',e.message);
}).finally(function(){
  db.();
});
