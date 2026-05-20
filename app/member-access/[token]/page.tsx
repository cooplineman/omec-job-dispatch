"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function MemberAccessPage({params}:{params:{token:string}}){
const [jobs,setJobs]=useState<any[]>([]);
const [loading,setLoading]=useState(true);

useEffect(()=>{
async function load(){
const {data}=await supabase.rpc("get_member_jobs_by_access_token",{p_token:params.token});
setJobs(data||[]);
setLoading(false);
}
load();
},[params.token]);

if(loading) return <main style={{padding:40}}>Loading...</main>;
if(jobs.length===0) return <main style={{padding:40}}>No active access link.</main>;

const job=jobs[0];

return <main style={{padding:40}}>
<h1>OMEC Connect</h1>
<h2>{job.applicant_name}</h2>
<p>{job.job_number}</p>
<p>{job.public_status}</p>
</main>;
}
