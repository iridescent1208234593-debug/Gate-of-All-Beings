import type { EcoIndividual } from '@lxh/shared-types/models';
import { validateEcoIndividual } from '@lxh/shared-types/exchange';
import type { Card } from './types';
import { cardText } from './cardText';

/** Effects are derived locally from bounded traits; JSON can never supply executable effects. */
export function ecologyCard(value: EcoIndividual): Card {
  const i=validateEcoIndividual(value), t=i.traits;
  const card: Card={id:i.id,name:i.name,owner:'all',school:'shengling',element:i.element,
    cost:i.role==='carnivore'?2:1,type:i.role==='carnivore'?'攻击':'技能',
    glyph:i.role==='producer'?'芽':i.role==='herbivore'?'伴':'巡',text:'',
    source:`灵境个体 · ${i.sourceId}`,
    effect:i.role==='producer'?{block:4+Math.floor(t.vitality/2),draw:1}:
      i.role==='herbivore'?{block:3+Math.floor(t.size/2),strength:1}:
      {damage:10+Math.floor(t.size/2),weak:t.speed>=7?2:1},
    exhaust:i.role==='herbivore'};
  card.text=cardText(card);return card;
}
