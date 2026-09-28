"use client";
import Link from "next/link";
import React, { useReducer } from "react";
import { CUSTOM_ITEMS, customiseReducer, initialCustomiseState, type CustomCategory } from "./customise-state";

const categories:readonly {id:CustomCategory;label:string}[]=[{id:"colour",label:"Colour"},{id:"outfit",label:"Outfit"},{id:"extras",label:"Extras"}];
export default function CustomisePage(){
  const[state,dispatch]=useReducer(customiseReducer,initialCustomiseState);
  const colour=CUSTOM_ITEMS.find((item)=>item.id===state.selected.colour)?.value;
  const outfit=CUSTOM_ITEMS.find((item)=>item.id===state.selected.outfit)?.value;
  const extra=CUSTOM_ITEMS.find((item)=>item.id===state.selected.extras)?.value;
  return <main className="customise"><section className="character-stage"><div className="character" aria-label={`Character preview, ${outfit} outfit, ${extra} extra`} style={{background:colour}}>Z</div></section><section className="custom-panel stack"><div className="row-between"><Link href="/profile" aria-label="Close customisation">×</Link><span className="pill">◆ 340</span></div><div><h1>Your look</h1><p className="muted">Selections are local previews. Looks never change your stats.</p></div>
    <div className="tabs customise-tabs" role="tablist" aria-label="Customisation category">{categories.map((category)=><button key={category.id} type="button" role="tab" aria-selected={state.category===category.id} className={state.category===category.id?"active":""} onClick={()=>dispatch({type:"category",category:category.id})}>{category.label}</button>)}</div>
    <div className="options">{CUSTOM_ITEMS.filter((item)=>item.category===state.category).map((item)=><button key={item.id} type="button" className={`option ${state.selected[item.category]===item.id?"active":""}`} aria-label={`${item.label}${item.locked?`, locked: ${item.unlock}`:""}`} aria-pressed={state.selected[item.category]===item.id} disabled={item.locked} onClick={()=>dispatch({type:"select",itemId:item.id})} style={item.category==="colour"?{background:item.value}:undefined}><span>{item.category==="colour"?"":item.value}</span>{item.locked&&<small>Locked · {item.unlock}</small>}</button>)}</div>
    <button className="button button-secondary" type="button" onClick={()=>dispatch({type:"reset"})}>Reset local preview</button><Link className="button button-primary" href="/profile">Discard preview & return</Link><p className="preview-note">Returning discards these selections. Nothing is applied, purchased, or persisted. Locked looks show their future unlock condition and cannot be selected.</p>
  </section></main>;
}
