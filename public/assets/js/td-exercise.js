import { el, button, heading } from './ui.js';
import { TD_SPIRA_2022, calculateTD } from './td-scoring.js';
const fmt = n => n === null ? '—' : new Intl.NumberFormat('fr-FR', {maximumFractionDigits:2}).format(n);
const money = n => n === null ? '—' : fmt(n) + ' FCFA';
const tile = (name,value) => el('article',{className:'gi-tile'},el('span',{},name),el('strong',{},value));
export function mountTDExercise() {
  const root = el('div',{className:'gi-stack'});
  const introduction = el('section',{className:'panel gi-section'},
    el('h2',{},'Analyse des achats clients'));
  const table = el('table',{className:'gi-table'}, el('thead',{},el('tr',{},
    ...['Client','Achats/an','Montant/an (FCFA)','Période (mois)','R','F','M','Total / 15'].map(label=>el('th',{scope:'col'},label)))));
  const tbody=el('tbody');table.append(tbody);
  const fields=[];
  for(const [name,purchases,amount,months] of TD_SPIRA_2022) {
    const inputs=[purchases,amount,months].map((v,index)=>el('input',{
      type:'number',required:true,min:index===2?'1':'0',max:index===2?'12':'1000000000000',
      step:'1',value:String(v),className:'gi-td-input',
      'aria-label':name+' '+['achats','montant','mois'][index]
    }));
    const result=[el('td'),el('td'),el('td'),el('td')];
    tbody.append(el('tr',{},el('th',{scope:'row'},name),
      ...inputs.map(input=>el('td',{},input)),...result));
    fields.push({name,inputs,result});
  }
  const actions=el('div',{className:'gi-actions'});
  const compute=button('Effectuer les calculs',{type:'submit',className:'button button-primary'});
  const reset=button('Réinitialiser le tableau',{className:'button button-secondary'});
  actions.append(compute,reset);
  const error=el('p',{className:'gi-error',role:'alert'});
  const totals=el('div',{className:'gi-kpis'});
  const form=el('form',{className:'gi-stack'},
    el('div',{className:'gi-scroll gi-td-scroll'},table),actions,error);
  function render(){
    try{
      const rows=fields.map(({name,inputs})=>{
        const [purchases,amount,months]=inputs.map(input=>{
          const v=input.value.trim();
          if(!/^(0|[1-9][0-9]*)$/.test(v) || !Number.isSafeInteger(Number(v)))throw Error('Saisie invalide : '+name);
          return Number(v);
        });
        return {name,purchases,amount,months};
      });
      const result=calculateTD(rows);
      result.data.forEach((row,i)=>{
        const p=row.points;
        [p.r,p.f,p.m,p.total].forEach((value,j)=>fields[i].result[j].textContent=String(value));
      });
      totals.replaceChildren(
        tile('Clients',fmt(result.clients)),
        tile('Achats totaux',fmt(result.purchases)),
        tile('Montant total',money(result.amount)),
        tile('Panier moyen',money(result.basket)),
        tile('Achats / client',fmt(result.frequency)),
        tile('CA / client',money(result.perCustomer)));
      error.textContent='';
    }catch(e){error.textContent=e.message;}
  }
  form.addEventListener('submit',event=>{event.preventDefault();render();});
  reset.addEventListener('click',()=>{
    fields.forEach((field,i)=>field.inputs.forEach((input,j)=>{input.value=String(TD_SPIRA_2022[i][j+1]);}));
    render();
  });
  const interpretation=el('section',{className:'panel gi-section'},
    el('h2',{},'Répartition des scores'),
    el('p',{},'R : 5 points pour 1 à 2 mois, 3 pour 3 à 7, 1 au-delà de 7. F : 5 points au-dessus de 5 achats, 3 pour 2 à 5, 1 en dessous de 2. M : 5 points au-dessus de 4 millions FCFA, 3 de 2 à 4 millions, 1 en dessous de 2 millions.'),
    el('p',{className:'gi-footnote'},'Les scores calculés sur ce tableau représentent une comparaison des données saisies, indépendante des segments du portefeuille réel.'),
    el('p',{className:'gi-footnote'},'Les scores d’analyse ne modifient pas les points de fidélité des clients.'));
  root.append(introduction,form,totals,interpretation);
  render();
  return root;
}
