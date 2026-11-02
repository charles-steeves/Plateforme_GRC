export function clientValue(annualValue, retention, margin, acquisition, discount) {
  const params = [retention, margin, acquisition, discount];
  if (params.some(x => !Number.isFinite(x) || x < 0) || retention >= 100 || margin > 100 ||
      discount > 100 || acquisition > 1e12) throw new Error('Paramètres hors limites.');
  if (annualValue !== null && (!Number.isFinite(annualValue) || annualValue < 0)) throw new Error('Montant invalide.');
  const r = retention / 100, m = margin / 100, d = discount / 100;
  return {
    duration: 1 / (1 - r),
    gross: annualValue === null ? null : annualValue / (1 - r),
    net: annualValue === null ? null : annualValue * m / (1 + d - r) - acquisition
  };
}

export function surveyScore(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (rows.some(r => !Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5 ||
      !Number.isInteger(r.recommendation) || r.recommendation < 0 || r.recommendation > 10))
    throw new Error('Réponse invalide.');
  const promoters = rows.filter(x => x.recommendation >= 9).length;
  const detractors = rows.filter(x => x.recommendation <= 6).length;
  const satisfied = rows.filter(x => x.rating >= 4).length;
  return {
    count: rows.length,
    average: rows.reduce((n, r) => n + r.rating, 0) / rows.length,
    satisfaction: 100 * satisfied / rows.length,
    nps: 100 * (promoters - detractors) / rows.length
  };
}
