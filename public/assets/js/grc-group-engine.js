export const EXERCISE_GROUPS = Object.freeze([
  ['A',10,10000000,500],['B',30,7000000,700],['C',70,500000,500],
  ['D',100,1500000,200],['E',50,3000000,1000],['F',60,200000,1000],
  ['G',50,300000,5000],['H',40,1000000,600],['I',10,350000,200],
  ['J',20,750000,300],['K',300,11000000,100],['L',5,500000,300]
]);

export function calculateGroups(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) throw new Error('Groupes invalides.');
  const names = new Set();
  let clients = 0, orders = 0, revenue = 0;
  for (const row of rows) {
    const id = String(row.id || '').trim();
    if (!id || names.has(id)) throw new Error('Identifiant de groupe invalide ou en double.');
    names.add(id);
    for (const field of ['clients','orders','revenue']) {
      if (!Number.isSafeInteger(row[field]) || row[field] < 0 || row[field] > 1e12)
        throw new Error('Valeur invalide pour ' + id + '.');
    }
    clients += row.clients; orders += row.orders; revenue += row.revenue;
  }
  if (![clients,orders,revenue].every(Number.isSafeInteger)) throw new Error('Totaux trop importants.');
  return {
    clients, orders, revenue,
    basket: orders ? revenue / orders : null,
    frequency: clients ? orders / clients : null,
    annualValue: clients ? revenue / clients : null
  };
}
