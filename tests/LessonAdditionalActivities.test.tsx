import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ActivityView } from '@/features/course-pack/activities/ActivityView';
import { normalizePack } from '@/features/course-pack/normalize-pack';
import { makePilotPack } from './fixtures/lesson-variety';
const pack = normalizePack(makePilotPack());
it('reveals a comparison model before accepting a self rating', async () => {
 const change=vi.fn(), assist=vi.fn();
 render(<ActivityView activity={{kind:'self-compare',id:'compare',revision:1,conceptIds:[],vocabulary:[],skills:['speaking'],prompt:'Say hello',modelText:'Buongiorno'}} response={null} disabled={false} onChange={change} onAssist={assist}/>);
 expect(screen.queryByText('Buongiorno')).toBeNull();
 expect(screen.queryByRole('button',{name:'Comfortable'})).toBeNull();
 await userEvent.click(screen.getByRole('button',{name:'Reveal comparison model'}));
 expect(screen.getByText('Buongiorno')).toBeVisible();
 expect(assist).toHaveBeenCalledWith('model');
 await userEvent.click(screen.getByRole('button',{name:'Comfortable'}));
 expect(change).toHaveBeenCalledWith({kind:'self',rating:'comfortable'});
});
it('selects a scene region through a labeled keyboard-accessible control', async () => {
 const change=vi.fn();
 const activity = {kind:'scene-selection' as const,id:'scene-select',revision:1,conceptIds:[],vocabulary:[],skills:[] ,prompt:'Select the coffee',hints:[],feedback:'Correct',evidenceKey:'coffee',assistanceAffectsEvidence:['model' as const],stimulusId:'stm-cafe-menu',acceptedRegionIds:['rg-coffee']};
 render(<ActivityView activity={activity} stimulus={pack.stimuli[activity.stimulusId!]} response={null} disabled={false} onChange={change} onAssist={()=>{}}/>);
 await userEvent.click(screen.getByRole('checkbox',{name:'Caffè'}));
 expect(change).toHaveBeenCalledWith({kind:'selection',ids:['rg-coffee']});
});
