import assert from "node:assert/strict";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const projectId=process.env.GCLOUD_PROJECT||"budget-alexandre",host=process.env.FIRESTORE_EMULATOR_HOST;if(!host)throw new Error("FIRESTORE_EMULATOR_HOST is required.");
if(!getApps().length)initializeApp({projectId});const db=getFirestore();
await db.doc("workProjects/owner-project").set({ownerUid:"owner-a",name:"Owner project"});
await db.doc("workProjects/foreign-project").set({ownerUid:"owner-b",name:"Foreign project"});
const encode=(value)=>Buffer.from(JSON.stringify(value)).toString("base64url");
function headers(uid){const now=Math.floor(Date.now()/1000);const token=`${encode({alg:"none",typ:"JWT"})}.${encode({aud:projectId,iss:`https://securetoken.google.com/${projectId}`,sub:uid,user_id:uid,iat:now,exp:now+3600,auth_time:now,firebase:{identities:{},sign_in_provider:"custom"}})}.`;return {"Content-Type":"application/json",Authorization:`Bearer ${token}`};}
const base=`http://${host}/v1/projects/${projectId}/databases/(default)/documents/transactions`;
const fields=(ownerUid,workProjectId)=>({ownerUid:{stringValue:ownerUid},date:{stringValue:"2026-07-27"},montant:{doubleValue:25},type:{stringValue:"depense"},workProjectId:workProjectId===null?{nullValue:null}:{stringValue:workProjectId}});
async function write(id,uid,ownerUid,workProjectId){return fetch(`${base}/${id}`,{method:"PATCH",headers:headers(uid),body:JSON.stringify({fields:fields(ownerUid,workProjectId)})});}
assert.equal((await write("linked-own","owner-a","owner-a","owner-project")).ok,true,"owner links own project");
assert.equal((await write("linked-foreign-project","owner-a","owner-a","foreign-project")).ok,false,"foreign project rejected");
assert.equal((await write("linked-foreign-owner","owner-b","owner-a","owner-project")).ok,false,"foreign transaction owner rejected");
assert.equal((await write("linked-own","owner-a","owner-a",null)).ok,true,"association can be removed");
console.log("Work project transaction link Firestore rules: OK");