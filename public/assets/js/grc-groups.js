import { el, button, field } from './ui.js';
import { EXERCISE_GROUPS, calculateGroups } from './grc-group-engine.js';
const number = n => n === null ? '—' : new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(n);
const money = n => n === null ? '—' : number(n) + ' FCFA';
export function mountGroupCalculations() {
  const outer = el('div',{className:'gi-stack'});
  const intro = el('section',{className:'panel gi-section'},el('h2',{},'Calculs par groupe'),
    el('p',{className:'muted'},'Saisissez les données des 12 groupes puis calculez les indicateurs.'));
  const rows = EXERCISE_GROUPS.map(([id,clients,revenue,orders])=>({id,clients,revenue,orders}));
  const tbody=el('tbody');
  const output=el('div',{className:'gi-kpis'});
  const bars=el('div',{className:'gi-chart'});
  const error=el('p',{className:'gi-error',role:'alert'});
  const editors=[];
  function renderRows(){
    tbody.replaceChildren();editors.length=0;
    for(const item of rows){
      const inputs={};
      const cells=['clients','revenue','orders'].map(fieldName=>{
        const input=el('input',{type:'number',min:'0',max:'1000000000000',step:'1',required:true,
          value:String(item[fieldName]),'aria-label':item.id+' '+fieldName,className:'gi-group-input'});
        inputs[fieldName]=input;
        return el('td',{},input);
      });
      editors.push({item,inputs});
      tbody.append(el('tr',{},el('th',{scope:'row'},item.id),...cells));
    }
  }
  function calculate(){
    try{
      for(const {item,inputs} of editors){
        for(const key of ['clients','orders','revenue']){
          const v=inputs[key].value.trim();
          const n=Number(v);
          if(!/^(0|[1-9][0-9]*)$/.test(v)||!Number.isSafeInteger(n))throw new Error('Saisie incorrecte : groupe '+item.id+'.');
          item[key]=n;
        }
      }
      const r=calculateGroups(rows);
      output.replaceChildren(
        ...[['Clients',number(r.clients)],['Achats',number(r.orders)],['CA total',money(r.revenue)],
          ['Panier moyen',money(r.basket)],['Fréquence',number(r.frequency)],
          ['CA par client',money(r.annualValue)]].map(([label,value])=>
          el('article',{className:'gi-tile'},el('span',{},label),el('strong',{},value))));
      const maximum=Math.max(1,...rows.map(x=>x.revenue));
      bars.replaceChildren(...rows.map(x=>
        el('div',{className:'gi-chart-row'},
          el('span',{},x.id),el('progress',{max:String(maximum),value:String(x.revenue),
            'aria-label':'Groupe '+x.id+' : '+money(x.revenue)}),
          el('strong',{},money(x.revenue)))));
      error.textContent='';
    }catch(e){error.textContent=e.message;}
  }
  renderRows();
  const form=el('form',{className:'gi-stack'},
    el('div',{className:'gi-scroll'},
      el('table',{className:'gi-table'},el('thead',{},el('tr',{},
        ['Groupe','Clients','CA (FCFA)','Achats'].map(x=>el('th',{scope:'col'},x)))),tbody)),
    el('div',{className:'gi-actions'},button('Calculer les résultats',{type:'submit'})),
    error);
  form.addEventListener('submit',e=>{e.preventDefault();calculate();});
  const results=el('section',{className:'panel gi-section'},el('h2',{},'Résultats'),output,bars);
  intro.append(form);
  outer.append(intro,results);
  calculate();
  return outer;
}
