import assert from "node:assert/strict";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const projectId=process.env.GCLOUD_PROJECT||"budget-alexandre", host=process.env.FIRESTORE_EMULATOR_HOST;if(!host)throw new Error("FIRESTORE_EMULATOR_HOST is required.");
if(!getApps().length)initializeApp({projectId}); const adminDb=getFirestore();
const owner="work-project-owner", foreign="work-project-foreign", id="work-project-v3", now=new Date();
await adminDb.doc(`professionalActivities/activity-v3`).set({ownerUid:owner,name:"Conseil"});
await adminDb.doc(`thirdParties/customer-v3`).set({ownerUid:owner,name:"Client"});
await adminDb.doc(`workQuotes/${id}`).set({ownerUid:owner,professionalActivityId:"activity-v3",thirdPartyId:"customer-v3",status:"accepted",projectId:id});
await adminDb.doc(`workProjects/${id}`).set({ownerUid:owner,quoteId:id,professionalActivityId:"activity-v3",thirdPartyId:"customer-v3",name:"Test",status:"planned",plannedRevenue:1000,plannedExpenses:0,plannedMargin:1000,startDate:null,endDate:null,createdAt:now,updatedAt:now,deletedAt:null});
const encode=(value)=>Buffer.from(JSON.stringify(value)).toString("base64url");
function headers(uid){const seconds=Math.floor(Date.now()/1000);const token=`${encode({alg:"none",typ:"JWT"})}.${encode({aud:projectId,iss:`https://securetoken.google.com/${projectId}`,sub:uid,user_id:uid,iat:seconds,exp:seconds+3600,auth_time:seconds,firebase:{identities:{},sign_in_provider:"custom"}})}.`;return {"Content-Type":"application/json",Authorization:`Bearer ${token}`};}
const name=`projects/${projectId}/databases/(default)/documents/workProjects/${id}`, origin=`http://${host}/v1/projects/${projectId}/databases/(default)`;
const value=(v)=>v===null?{nullValue:null}:typeof v==="number"?{doubleValue:v}:{stringValue:v};
async function update(uid,fields){const paths=Object.keys(fields);return fetch(`${origin}/documents:commit`,{method:"POST",headers:headers(uid),body:JSON.stringify({writes:[{update:{name,fields:Object.fromEntries(Object.entries(fields).filter(([key])=>key!=="updatedAt").map(([key,v])=>[key,value(v)]))},updateMask:{fieldPaths:paths.filter((key)=>key!=="updatedAt")},updateTransforms:[{fieldPath:"updatedAt",setToServerValue:"REQUEST_TIME"}]}]})});}
assert.equal((await update(owner,{name:"Nouveau nom",status:"in_progress",plannedExpenses:250,plannedMargin:750,description:"Description",notes:"Notes",startDate:"2026-08-01",endDate:"2026-08-31",updatedAt:true})).ok,true,"owner editable update");
assert.equal((await update(owner,{plannedExpenses:-1,plannedMargin:1001,updatedAt:true})).ok,false,"negative expenses");
assert.equal((await update(owner,{status:"invalid",updatedAt:true})).ok,false,"invalid status");
assert.equal((await update(owner,{plannedRevenue:2000,updatedAt:true})).ok,false,"immutable revenue");
assert.equal((await update(owner,{thirdPartyId:"other",updatedAt:true})).ok,false,"immutable reference");
assert.equal((await update(foreign,{name:"Intrusion",updatedAt:true})).ok,false,"foreign update");
console.log("Work project V3 Firestore rules: OK");