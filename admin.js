const { createClient } = window.supabase;
const sb = createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

const loginPanel=document.getElementById("loginPanel");
const dashboard=document.getElementById("dashboard");
const msg=document.getElementById("loginMsg");
const classSelect=document.getElementById("classSelect");
const subjectSelect=document.getElementById("subjectSelect");

async function boot(){
  if(window.SUPABASE_URL.includes("PASTE_")){msg.textContent="Configure config.js first.";return;}
  const {data:{session}}=await sb.auth.getSession();
  if(session) showDashboard(session);
}
function showDashboard(session){
  loginPanel.classList.add("hidden"); dashboard.classList.remove("hidden");
  document.getElementById("userEmail").textContent=session.user.email||"Admin";
  loadAll();
}
document.getElementById("login").onclick=async()=>{
  msg.textContent="Signing in…";
  const email=document.getElementById("email").value.trim();
  const password=document.getElementById("password").value;
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error){msg.textContent=error.message;return;}
  showDashboard(data.session);
};
document.getElementById("logout").onclick=async()=>{await sb.auth.signOut();location.reload()};

async function loadAll(){
  const {data,error}=await sb.from("classes").select("id,name,sort_order,subjects(id,name,sort_order,notes(id,title,file_url,created_at))").order("sort_order");
  if(error){alert(error.message);return;}
  renderClasses(data);
  renderSelects(data);
  renderNotes(data);
}
function renderClasses(data){
  document.getElementById("classList").innerHTML=data.map(c=>`
    <div class="list-row"><span>${esc(c.name)}</span><button class="danger" onclick="deleteClass('${c.id}')">Delete</button></div>`).join("")||"<p class='muted'>No classes.</p>";
}
function renderSelects(data){
  classSelect.innerHTML=data.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
  updateSubjects(data);
  classSelect.onchange=()=>updateSubjects(data);
}
function updateSubjects(data){
  const c=data.find(x=>x.id===classSelect.value);
  subjectSelect.innerHTML=(c?.subjects||[]).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("");
}
function renderNotes(data){
  let html="";
  data.forEach(c=>c.subjects.forEach(s=>s.notes.forEach(n=>{
    html+=`<div class="list-row"><span>📄 <b>${esc(n.title)}</b><small> · ${esc(c.name)} / ${esc(s.name)}</small></span><button class="danger" onclick="deleteNote('${n.id}','${esc(n.file_url)}')">Delete</button></div>`;
  })));
  document.getElementById("contentList").innerHTML=html||"<p class='muted'>No notes published yet.</p>";
}
document.getElementById("addClass").onclick=async()=>{
  const name=document.getElementById("className").value.trim();
  if(!name)return alert("Enter a class name.");
  const {data:max}=await sb.from("classes").select("sort_order").order("sort_order",{ascending:false}).limit(1);
  const sort=(max?.[0]?.sort_order||0)+1;
  const {error}=await sb.from("classes").insert({name,sort_order:sort});
  if(error)alert(error.message);else{document.getElementById("className").value="";loadAll();}
};
document.getElementById("addSubject").onclick=async()=>{
  const name=document.getElementById("subjectName").value.trim();
  if(!name)return alert("Enter a subject name.");
  const {data:max}=await sb.from("subjects").select("sort_order").eq("class_id",classSelect.value).order("sort_order",{ascending:false}).limit(1);
  const sort=(max?.[0]?.sort_order||0)+1;
  const {error}=await sb.from("subjects").insert({class_id:classSelect.value,name,sort_order:sort});
  if(error)alert(error.message);else{document.getElementById("subjectName").value="";loadAll();}
};
document.getElementById("uploadNote").onclick=async()=>{
  const title=document.getElementById("noteTitle").value.trim();
  const file=document.getElementById("noteFile").files[0];
  if(!title||!file)return alert("Enter a title and choose a PDF.");
  if(file.type!=="application/pdf")return alert("Please select a PDF file.");
  if(file.size>20*1024*1024)return alert("PDF must be 20 MB or smaller.");
  const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const path=`${crypto.randomUUID()}-${safe}`;
  const {error:upErr}=await sb.storage.from("notes").upload(path,file,{contentType:"application/pdf",upsert:false});
  if(upErr){alert(upErr.message);return;}
  const {data:urlData}=sb.storage.from("notes").getPublicUrl(path);
  const {data:max}=await sb.from("notes").select("sort_order").eq("subject_id",subjectSelect.value).order("sort_order",{ascending:false}).limit(1);
  const sort=(max?.[0]?.sort_order||0)+1;
  const {error:dbErr}=await sb.from("notes").insert({subject_id:subjectSelect.value,title,file_path:path,file_url:urlData.publicUrl,sort_order:sort});
  if(dbErr){await sb.storage.from("notes").remove([path]);alert(dbErr.message);return;}
  document.getElementById("noteTitle").value="";document.getElementById("noteFile").value="";
  alert("PDF uploaded and published.");loadAll();
};
window.deleteClass=async(id)=>{
  if(!confirm("Delete this class and all its subjects/notes?"))return;
  const {error}=await sb.from("classes").delete().eq("id",id);
  if(error)alert(error.message);else loadAll();
};
window.deleteNote=async(id,fileUrl)=>{
  if(!confirm("Delete this note?"))return;
  const {data:n,error:e}=await sb.from("notes").select("file_path").eq("id",id).single();
  if(e){alert(e.message);return;}
  const {error}=await sb.from("notes").delete().eq("id",id);
  if(error){alert(error.message);return;}
  if(n?.file_path)await sb.storage.from("notes").remove([n.file_path]);
  loadAll();
};
boot();