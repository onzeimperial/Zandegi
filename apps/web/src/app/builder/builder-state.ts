export const PROOF_TIERS = ["Check-in", "Photo / score", "Peer confirms"] as const;
export type ProofTier = (typeof PROOF_TIERS)[number];
export interface LocalStep { id:number; title:string; when:string; proof:ProofTier; }
export interface LocalChapter { id:number; title:string; goal:string; steps:LocalStep[]; }
export interface BuilderState { missionName:string; goalType:"OUTCOME"|"METRIC"; metricNow:string; metricTarget:string; why:string; nextId:number; chapters:LocalChapter[]; }
export const initialBuilderState:BuilderState={missionName:"Get into medicine",goalType:"OUTCOME",metricNow:"",metricTarget:"",why:"I want to be the first doctor in my family.",nextId:7,chapters:[
  {id:1,title:"Know the pathway",goal:"Shortlist 5 universities and their entry rules",steps:[{id:2,title:"Read each university's official entry page",when:"Sunday 3:00 pm",proof:"Check-in"}]},
  {id:3,title:"Prepare for UCAT",goal:"Complete a full practice test under exam timing",steps:[{id:4,title:"Timed verbal reasoning set",when:"Monday 5:00 pm",proof:"Photo / score"},{id:5,title:"Review wrong answers with notes",when:"Saturday 10:00 am",proof:"Check-in"}]},
  {id:6,title:"Become interview ready",goal:"Complete three mock interviews with feedback",steps:[]},
]};
export type BuilderAction=
  |{type:"set-mission";value:string}|{type:"set-goal-type";value:BuilderState["goalType"]}|{type:"set-metric";field:"metricNow"|"metricTarget";value:string}|{type:"set-why";value:string}
  |{type:"set-chapter";chapterId:number;field:"title"|"goal";value:string}|{type:"add-chapter"}
  |{type:"add-step";chapterId:number}|{type:"set-step";chapterId:number;stepId:number;field:"title"|"when";value:string}
  |{type:"cycle-proof";chapterId:number;stepId:number}|{type:"remove-step";chapterId:number;stepId:number};

export function builderReducer(state:BuilderState,action:BuilderAction):BuilderState{
  if(action.type==="set-mission")return{...state,missionName:action.value};
  if(action.type==="set-goal-type")return{...state,goalType:action.value};
  if(action.type==="set-metric")return{...state,[action.field]:action.value};
  if(action.type==="set-why")return{...state,why:action.value};
  if(action.type==="add-chapter"){const id=state.nextId;return{...state,nextId:id+1,chapters:[...state.chapters,{id,title:"",goal:"",steps:[]}]};}
  return{...state,chapters:state.chapters.map((chapter)=>{
    if(chapter.id!==action.chapterId)return chapter;
    if(action.type==="set-chapter")return{...chapter,[action.field]:action.value};
    if(action.type==="add-step"){const id=state.nextId;return{...chapter,steps:[...chapter.steps,{id,title:"",when:"Pick a time",proof:"Check-in"}]};}
    return{...chapter,steps:chapter.steps.flatMap((step)=>{
      if(step.id!==action.stepId)return[step];
      if(action.type==="remove-step")return[];
      if(action.type==="set-step")return[{...step,[action.field]:action.value}];
      const index=PROOF_TIERS.indexOf(step.proof);return[{...step,proof:PROOF_TIERS[(index+1)%PROOF_TIERS.length]!}];
    })};
  }),nextId:action.type==="add-step"?state.nextId+1:state.nextId};
}
