import { describe,expect,it } from "vitest";
import { canSubmitGeneration,generatorReducer,initialGeneratorState,visibleStageState } from "./generator-state";
import { generationRequestInit } from "./request";

describe("generator UI state",()=>{
  it("sends the protected exact request shape",()=>{const signal=new AbortController().signal;const init=generationRequestInit("Learn Farsi",signal);expect(init.method).toBe("POST");expect(init.headers).toEqual({"Content-Type":"application/json"});expect(JSON.parse(String(init.body))).toEqual({rawText:"Learn Farsi"});expect(init.signal).toBe(signal)});
  it("disables submission for blank ambitions and while generation is active",()=>{expect(canSubmitGeneration("","idle")).toBe(false);expect(canSubmitGeneration("Bench 100 kg","generating")).toBe(false);expect(canSubmitGeneration("Bench 100 kg","idle")).toBe(true)});
  it("starts clean and only adds chapters when a progress event includes one",()=>{const started=generatorReducer(initialGeneratorState,{type:"start"});const detail=generatorReducer(started,{type:"progress",event:{stage:"detail",status:"start",detail:"Writing steps"}});expect(detail.chapters).toHaveLength(0);const chapter={index:0,title:"Start",exitCondition:"Evidence gathered",completionXp:50,steps:[]};const revealed=generatorReducer(detail,{type:"progress",event:{stage:"detail",status:"done",chapter}});expect(revealed.chapters).toEqual([chapter])});
  it("keeps refusal and transport errors distinct for retry",()=>{const refused=generatorReducer(initialGeneratorState,{type:"result",result:{event:null,refusal:{reason:"Please clarify",route:"clarify"}}});expect(refused.status).toBe("refusal");const failed=generatorReducer(initialGeneratorState,{type:"error",message:"Generation ended before a result arrived."});expect(failed).toMatchObject({status:"error",error:"Generation ended before a result arrived."})});
  it("resets refusal and error state for retry",()=>{const failed=generatorReducer(initialGeneratorState,{type:"error",message:"Failed"});expect(generatorReducer(failed,{type:"reset"})).toEqual(initialGeneratorState)});
  it("keeps the combined resolve row active while hydrate runs",()=>{expect(visibleStageState("resolve","hydrate")).toBe("active");expect(visibleStageState("interpret","hydrate")).toBe("done");expect(visibleStageState("plan","hydrate")).toBe("pending")});
});
