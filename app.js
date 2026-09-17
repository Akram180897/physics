const { createClient } = window.supabase;
const sb = createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);

const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const classesEl = document.getElementById("classes");
const statusEl = document.getElementById("status");
const emptyEl = document.getElementById("empty");

async function loadSite(){
  if(window.SUPABASE_URL.includes("PASTE_")){
    statusEl.textContent="Configure Supabase first";
    emptyEl.classList.remove("hidden");
    emptyEl.textContent="Open config.js and add your Supabase URL and publishable key.";
    return;
  }
  const {data,error}=await sb.from("classes").select("id,name,sort_order,subjects(id,name,sort_order,notes(id,title,file_url,sort_order))").order("sort_order");
  if(error){statusEl.textContent="Connection error"; emptyEl.classList.remove("hidden"); emptyEl.textContent=error.message; return;}
  statusEl.textContent=`${data.length} class${data.length===1?"":"es"}`;
  if(!data.length){emptyEl.classList.remove("hidden");return;}
  classesEl.innerHTML=data.map(c=>`
    <article class="class-card">
      <span class="class-tag">CLASS</span>
      <h3>${esc(c.name)}</h3>
      <p>${c.subjects.length} subject${c.subjects.length===1?"":"s"}</p>
      <button class="open-btn" data-id="${c.id}">View materials →</button>
      <div class="subjects hidden" id="subjects-${c.id}">
        ${c.subjects.length ? c.subjects.map(s=>`
          <div class="subject">
            <strong>${esc(s.name)}</strong>
            ${s.notes.length ? s.notes.map(n=>`<a class="note" target="_blank" rel="noopener" href="${esc(n.file_url)}">📄 ${esc(n.title)}</a>`).join("") : `<span class="no-notes">No notes uploaded yet.</span>`}
          </div>`).join("") : `<span class="no-notes">No subjects added yet.</span>`}
      </div>
    </article>`).join("");
  document.querySelectorAll(".open-btn").forEach(btn=>btn.onclick=()=>{
    const el=document.getElementById("subjects-"+btn.dataset.id);
    el.classList.toggle("hidden");
    btn.textContent=el.classList.contains("hidden")?"View materials →":"Hide materials ↑";
  });
}
loadSite();