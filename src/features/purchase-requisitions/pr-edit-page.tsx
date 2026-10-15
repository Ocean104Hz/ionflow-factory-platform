"use client";
import { usePR } from "./pr-provider";
import { PREditor } from "./pr-editor";
export function PREditPage({id}:{id:string}){const {records}=usePR();const pr=records.find(r=>r.id===id);return pr?<PREditor key={id} original={pr}/>:<p role="alert">ไม่พบ PR</p>;}
