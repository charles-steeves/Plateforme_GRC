/**
 * TD SPIRA, examen 2022. Every row is copied from the supplied annex 1.
 * The annex supplies no actual last-purchase dates: 'months' is a proxy,
 * NOT a measured RFM recency. This simulation never updates SQLite.
 */
export const TD_SPIRA_2022 = [
  [
    "A",
    5,
    14000000,
    5
  ],
  [
    "B",
    7,
    10000000,
    5
  ],
  [
    "C",
    3,
    1100000,
    3
  ],
  [
    "D",
    2,
    2500000,
    8
  ],
  [
    "E",
    1,
    1900000,
    1
  ],
  [
    "F",
    1,
    2000000,
    3
  ],
  [
    "G",
    7,
    2500000,
    5
  ],
  [
    "H",
    6,
    5000000,
    6
  ],
  [
    "I",
    4,
    8000000,
    7
  ],
  [
    "J",
    3,
    12000000,
    8
  ],
  [
    "K",
    5,
    1000000,
    5
  ],
  [
    "L",
    2,
    3000000,
    2
  ],
  [
    "M",
    4,
    5000000,
    9
  ],
  [
    "N",
    5,
    3800000,
    7
  ],
  [
    "O",
    3,
    2800000,
    6
  ],
  [
    "P",
    6,
    2900000,
    10
  ],
  [
    "Q",
    3,
    12000000,
    11
  ],
  [
    "R",
    7,
    3000000,
    6
  ],
  [
    "S",
    4,
    4000000,
    7
  ],
  [
    "T",
    2,
    4500000,
    9
  ],
  [
    "U",
    5,
    2000000,
    10
  ],
  [
    "V",
    7,
    3500000,
    7
  ],
  [
    "W",
    4,
    2800000,
    9
  ],
  [
    "X",
    5,
    4000000,
    8
  ],
  [
    "Y",
    6,
    5000000,
    5
  ],
  [
    "Z",
    7,
    2700000,
    6
  ]
];
export function scoreTD({purchases, amount, months}) {
  if (![purchases,amount,months].every(Number.isSafeInteger)
      || purchases < 0 || amount < 0 || months < 1 || months > 12)
    throw new RangeError('Nombre d’achats, montant ou mois invalide.');
  // Annex 2: R <=2 => 5, 3..7 => 3, >7 => 1.
  // Caution: TD labels this input "mois", not date of last purchase.
  const r = months <= 2 ? 5 : months <= 7 ? 3 : 1;
  // Annex 2: above 5 purchases -> 5; 2..5 -> 3; below 2 -> 1.
  const f = purchases > 5 ? 5 : purchases >= 2 ? 3 : 1;
  // Annex 2: strictly above 4m => 5; 2m..4m => 3; below 2m => 1.
  const m = amount > 4000000 ? 5 : amount >= 2000000 ? 3 : 1;
  return {r,f,m,total:r+f+m};
}
export function calculateTD(rows) {
  const data = rows.map(row => ({ ...row, points:scoreTD(row) }));
  const amount = data.reduce((sum,row)=>sum+row.amount,0);
  const purchases = data.reduce((sum,row)=>sum+row.purchases,0);
  if (!Number.isSafeInteger(amount)||!Number.isSafeInteger(purchases))throw new RangeError('Total trop grand.');
  return {data, clients:data.length, amount, purchases,
    basket:purchases>0?amount/purchases:null,
    perCustomer:data.length>0?amount/data.length:null,
    frequency:data.length>0?purchases/data.length:null,
    totalPoints:data.reduce((sum,row)=>sum+row.points.total,0)};
}
