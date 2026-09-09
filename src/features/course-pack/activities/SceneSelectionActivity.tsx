"use client";
import type { Response, SceneStimulus } from '../lesson-runtime';
export function SceneSelectionActivity({stimulus,response,disabled,onChange}: {
 stimulus: SceneStimulus; response: Response | null; disabled: boolean;
 onChange: (response: Response) => void;
}) {
 const selected=response?.kind==='selection'?response.ids:[];
 return <fieldset className="lp-options">
  <legend>Select the matching parts of the scene</legend>
  {stimulus.regions.map(region=><label className="lp-option" key={region.id}>
   <input type="checkbox" disabled={disabled} checked={selected.includes(region.id)} onChange={event=>onChange({kind:'selection',ids:event.target.checked?[...selected,region.id]:selected.filter(id=>id!==region.id)})}/>
   <span>{region.label}</span>
  </label>)}
 </fieldset>;
}
