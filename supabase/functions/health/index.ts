// Optional authenticated deployment check; authoritative gameplay stays in PostgreSQL.
import { createClient } from 'npm:@supabase/supabase-js@2';
Deno.serve(async (req: Request) => {
 const headers={ 'Content-Type':'application/json' };
 const authorization=req.headers.get('Authorization');
 if(!authorization)return new Response(JSON.stringify({error:'Authentication required'}),{status:401,headers});
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}}});
 const {error}=await client.auth.getUser();
 if(error)return new Response(JSON.stringify({error:'Invalid session'}),{status:401,headers});
 return new Response(JSON.stringify({ok:true,game:'Midnight Council',version:'1.0.0'}),{headers});
});
