export type CustomCategory="colour"|"outfit"|"extras";
export interface CustomItem{id:string;label:string;category:CustomCategory;value:string;locked?:boolean;unlock?:string}
export const CUSTOM_ITEMS:readonly CustomItem[]=[
  {id:"violet",label:"Zandegi violet",category:"colour",value:"#6f42e8"},{id:"teal",label:"Trail teal",category:"colour",value:"#158c9a"},{id:"ember",label:"Ember",category:"colour",value:"#c85824"},{id:"mythic",label:"Mythic prism",category:"colour",value:"linear-gradient(135deg,#7c3aed,#22d3ee,#f59e0b)",locked:true,unlock:"Level 80"},
  {id:"classic",label:"Classic",category:"outfit",value:"Classic"},{id:"trail",label:"Trail jacket",category:"outfit",value:"Trail"},{id:"vanguard",label:"Vanguard armour",category:"outfit",value:"Vanguard",locked:true,unlock:"Vanguard rank"},
  {id:"none",label:"No extra",category:"extras",value:"None"},{id:"aurora",label:"Aurora frame",category:"extras",value:"Aurora"},{id:"crown",label:"Crown badge",category:"extras",value:"Crown",locked:true,unlock:"90 Shards"},
] as const;
export interface CustomiseState{category:CustomCategory;selected:Record<CustomCategory,string>}
export const initialCustomiseState:CustomiseState={category:"colour",selected:{colour:"violet",outfit:"classic",extras:"none"}};
export type CustomiseAction={type:"category";category:CustomCategory}|{type:"select";itemId:string}|{type:"reset"};
export function customiseReducer(state:CustomiseState,action:CustomiseAction):CustomiseState{
  if(action.type==="reset")return initialCustomiseState;
  if(action.type==="category")return{...state,category:action.category};
  const item=CUSTOM_ITEMS.find((candidate)=>candidate.id===action.itemId);
  if(!item||item.locked)return state;
  return{...state,selected:{...state.selected,[item.category]:item.id}};
}
