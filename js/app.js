(function(){
"use strict";
const $=id=>document.getElementById(id), db=()=>window.ruyaSupabase;
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const nice=s=>String(s||"").replace(/[_-]/g," ").replace(/\b\w/g,c=>c.toUpperCase());
let user=null,profile=null,page="Overview";
const menus={student:["Overview","My courses","Class schedule","Assignments","Attendance","Learning library","Messages"],teacher:["Overview","My classes","Teaching schedule","Assignments & grading","Attendance register","Learning resources","Messages"],management:["Overview","Academic programs","People & roles","Timetables","Academic records","Learning library","Announcements","Messages"]};
function toast(s){const e=$("toast");e.textContent=s;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),3200)}
function close(){ $("loginModal").classList.remove("show");$("authPassword").value=""; }
function mode(m){const signup=m==="signup";$("authNameWrap").hidden=!signup;$("authModeTitle").textContent=signup?"Create your student account":"Welcome back";$("authSubmit").textContent=signup?"Create account":"Sign in";$("authSubmit").onclick=signup?signupAction:signin;$("authSwitch").textContent=signup?"Already registered? Sign in":"Create a student account";$("authSwitch").dataset.mode=signup?"signin":"signup";$("authSwitch").onclick=()=>mode(signup?"signin":"signup");$("authError").textContent=""}
function openLogin(){ $("loginModal").classList.add("show");mode("signin") }
async function signin(){return authenticate(false)}
async function signupAction(){return authenticate(true)}
async function authenticate(signup){
 if(!db())return $("authError").textContent="Backend setup is not complete. Please see the production setup guide.";
 const email=$("authEmail").value.trim(),password=$("authPassword").value;
 if(!email||password.length<8)return $("authError").textContent="Enter your email and a password of at least 8 characters.";
 $("authSubmit").disabled=true;$("authError").textContent="";
 try{
  let result;
  if(signup){const name=$("authName").value.trim();if(!name)throw Error("Enter your full name.");result=await db().auth.signUp({email,password,options:{data:{full_name:name}}});}
  else result=await db().auth.signInWithPassword({email,password});
  if(result.error)throw result.error;
  if(result.data.session){await loadProfile(result.data.user);close()}
  else $("authError").textContent="Account created. Check your email to confirm it, then sign in.";
 }catch(e){$("authError").textContent=e.message||"Authentication failed."}
 finally{$("authSubmit").disabled=false}
}
async function resetPassword(){const email=$("authEmail").value.trim();if(!db()||!email)return toast("Enter your email first.");const r=await db().auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});toast(r.error?r.error.message:"Password reset instructions sent if the account exists.")}
async function loadProfile(u){
 const r=await db().from("profiles").select("*").eq("id",u.id).single();if(r.error)throw r.error;
 if(!r.data.is_active){await db().auth.signOut();throw Error("This account is inactive. Contact RU’YA management.")}
 user=u;profile=r.data;$("publicSite").style.display="none";$("dashboard").classList.add("show");
 $("roleLabel").textContent=nice(profile.role)+" workspace";$("dashUserName").textContent=profile.full_name||u.email;$("dashUserEmail").textContent=u.email;
 $("previewNote").textContent="SECURE WORKSPACE · "+u.email;await render("Overview");window.scrollTo(0,0)
}
function nav(){ $("workspaceNav").innerHTML=(menus[profile.role]||[]).map(n=>'<button class="workspace-nav '+(page===n?"active":"")+'" onclick="ruyaNavigate(\''+n.replace(/'/g,"\\'")+'\')"><span class="nav-ico">◆</span>'+esc(n)+'</button>').join("")}
function shell(title,desc,body){return '<div class="workspace-topline"><div class="eyebrow">RU’YA · '+esc(nice(profile.role))+' WORKSPACE</div><h1>'+esc(title)+'</h1><p class="welcome-sub">'+esc(desc)+'</p></div><div class="live-content">'+body+'</div>'}
function panel(title,body){return '<section class="workspace-card"><div class="card-heading"><h3>'+esc(title)+'</h3></div>'+(body||'<p class="empty-state">No records yet.</p>')+'</section>'}
function date(v){return v?new Date(v).toLocaleString([],{dateStyle:"medium",timeStyle:"short"}):"Not scheduled"}
function row(title,sub,tag){return '<div class="activity-row"><div class="activity-icon">◆</div><div class="activity-copy"><b>'+esc(title)+'</b><small>'+esc(sub)+'</small></div><span class="activity-tag">'+esc(tag||"")+'</span></div>'}
function empty(s){return '<p class="empty-state">'+esc(s)+'</p>'}
function field(label,name,type){return '<label class="live-field">'+esc(label)+'<input name="'+name+'" type="'+(type||"text")+'" required></label>'}
function formData(f){const o={};new FormData(f).forEach((v,k)=>o[k]=v);return o}
function bind(id,fn){const f=$(id);if(f)f.onsubmit=async e=>{e.preventDefault();try{await fn(f)}catch(x){toast(x.message||"Action failed.")}}}
async function render(p){
 page=p;nav();$("dashContent").innerHTML=shell(p,"Loading secure institutional records…",'<p class="loading-line">Connecting…</p>');
 try{
  let b="";
  if(p==="Overview")b=await overview();
  else if(p==="My courses"||p==="Academic programs")b=await courses();
  else if(["Class schedule","Teaching schedule","Timetables","My classes"].includes(p))b=await classes();
  else if(["Assignments","Assignments & grading"].includes(p))b=await assignments();
  else if(["Attendance","Attendance register"].includes(p))b=await attendance();
  else if(["Learning library","Learning resources","Resources"].includes(p))b=await library();
  else if(p==="People & roles")b=await people();
  else if(p==="Announcements")b=await announcements();
  else if(p==="Messages")b=await messages();
  else b=await records();
  $("dashContent").innerHTML=shell(p,"Live data from the RU’YA academic workspace.",b);
 }catch(e){$("dashContent").innerHTML=shell(p,"Unable to load this section.",panel("Connection issue",'<p class="error-copy">'+esc(e.message)+'</p><button class="btn btn-outline" onclick="ruyaNavigate(\''+p+'\')">Retry</button>'))}
}
async function overview(){
 let stats=[],activity="";
 if(profile.role==="student"){
  const a=await db().from("enrollments").select("id").eq("student_id",user.id).eq("status","active");
  const b=await db().from("assignments").select("id,title,due_at").eq("is_published",true).order("due_at").limit(6);
  const c=await db().from("attendance").select("id").eq("student_id",user.id);
  for(const x of [a,b,c])if(x.error)throw x.error;
  stats=[["Active courses",a.data.length],["Published assignments",b.data.length],["Attendance records",c.data.length]];
  activity=b.data.map(x=>row(x.title,"Due "+date(x.due_at),"ASSIGNMENT")).join("");
 }else if(profile.role==="teacher"){
  const a=await db().from("class_sections").select("id").eq("teacher_id",user.id);
  const b=await db().from("assignments").select("id,title").order("created_at",{ascending:false}).limit(6);
  const c=await db().from("submissions").select("id").is("score",null);
  for(const x of [a,b,c])if(x.error)throw x.error;
  stats=[["Assigned classes",a.data.length],["Assignments",b.data.length],["Awaiting grading",c.data.length]];
  activity=b.data.map(x=>row(x.title,"Your assignment","CREATED")).join("");
 }else{
  const a=await db().from("profiles").select("id",{count:"exact",head:true});
  const b=await db().from("courses").select("id",{count:"exact",head:true});
  const c=await db().from("class_sections").select("id",{count:"exact",head:true});
  const d=await db().from("submissions").select("id",{count:"exact",head:true}).is("score",null);
  for(const x of [a,b,c,d])if(x.error)throw x.error;
  stats=[["Registered users",a.count||0],["Courses",b.count||0],["Class sections",c.count||0],["Ungraded work",d.count||0]];
  activity=row("Institutional records","Counts from the live database","LIVE");
 }
 return '<div class="portal-hero"><small>SECURE RU’YA WORKSPACE</small><h2>Welcome, '+esc(profile.full_name||"RU’YA member")+'.</h2><p>Your account is connected. Information shown here is restricted by your role.</p></div><div class="workspace-stats">'+stats.map(x=>'<div class="workspace-stat"><div class="stat-top">'+esc(x[0])+'</div><strong>'+x[1]+'</strong><small>Live database count</small></div>').join("")+'</div>'+panel("Recent activity",activity||empty("No activity yet."));
}
async function courses(){
 if(profile.role==="student"){const r=await db().from("enrollments").select("status,class_sections(title,courses(title,code))").eq("student_id",user.id);if(r.error)throw r.error;return panel("My enrolled courses",(r.data||[]).map(x=>row(x.class_sections?.courses?.title||x.class_sections?.title,x.class_sections?.courses?.code||"",x.status)).join("")||empty("No course enrollments yet."))}
 const r=profile.role==="management"?await db().from("courses").select("*").order("created_at",{ascending:false}):await db().from("class_sections").select("title,courses(title,code)").eq("teacher_id",user.id);if(r.error)throw r.error;
 let form=profile.role==="management"?'<form class="live-form" id="courseForm">'+field("Course code","code")+field("Course title","title")+field("Category","category")+'<label class="live-field">Description<textarea name="description"></textarea></label><label class="check-field"><input type="checkbox" name="is_published"> Publish course</label><button class="btn btn-green">Create course</button></form>':"";
 setTimeout(()=>bind("courseForm",async f=>{const v=formData(f);const q=await db().from("courses").insert({code:v.code,title:v.title,category:v.category,description:v.description||"",is_published:!!v.is_published,created_by:user.id});if(q.error)throw q.error;toast("Course created.");render(page)}),0);
 return form+panel("Course catalogue",(r.data||[]).map(x=>row(x.title||x.courses?.title,x.code||x.courses?.code||"","ACTIVE")).join("")||empty("No courses have been added."));
}
async function classes(){
 let sections=[];
 if(profile.role==="student"){
  const q=await db().from("enrollments").select("class_sections(id,title,starts_at,meeting_url,courses(title))").eq("student_id",user.id).eq("status","active");if(q.error)throw q.error;sections=(q.data||[]).map(x=>x.class_sections).filter(Boolean);
 }else{
  const q=profile.role==="management"?await db().from("class_sections").select("id,title,starts_at,meeting_url,courses(title)"):await db().from("class_sections").select("id,title,starts_at,meeting_url,courses(title)").eq("teacher_id",user.id);if(q.error)throw q.error;sections=q.data||[];
 }
 let form="";
 if(profile.role==="management"){
  const [cs,ts]=await Promise.all([db().from("courses").select("id,title"),db().from("profiles").select("id,full_name,email").eq("role","teacher").eq("is_active",true)]);
  if(cs.error)throw cs.error;if(ts.error)throw ts.error;
  form='<form class="live-form" id="sectionForm"><label class="live-field">Course<select name="course_id">'+cs.data.map(x=>'<option value="'+x.id+'">'+esc(x.title)+'</option>').join("")+'</select></label><label class="live-field">Teacher<select name="teacher_id"><option value="">Unassigned</option>'+ts.data.map(x=>'<option value="'+x.id+'">'+esc(x.full_name||x.email)+'</option>').join("")+'</select></label>'+field("Section name","title")+'<label class="live-field">Meeting URL<input name="meeting_url" type="url"></label><button class="btn btn-green">Create class section</button></form>';
  setTimeout(()=>bind("sectionForm",async f=>{const v=formData(f);const q=await db().from("class_sections").insert({course_id:v.course_id,teacher_id:v.teacher_id||null,title:v.title,meeting_url:v.meeting_url||null});if(q.error)throw q.error;toast("Class section created.");render(page)}),0);
 }
 if(profile.role==="teacher"||profile.role==="management"){
  form+='<form class="live-form" id="sessionForm"><label class="live-field">Class section<select name="section_id">'+sections.map(x=>'<option value="'+x.id+'">'+esc(x.courses?.title||x.title)+' · '+esc(x.title)+'</option>').join("")+'</select></label>'+field("Session title","title")+'<label class="live-field">Starts at<input name="starts_at" type="datetime-local" required></label><label class="live-field">Ends at<input name="ends_at" type="datetime-local" required></label><label class="live-field">Meeting URL<input name="meeting_url" type="url"></label><button class="btn btn-green">Schedule session</button></form>';
  setTimeout(()=>bind("sessionForm",async f=>{const v=formData(f);const q=await db().from("class_sessions").insert({section_id:v.section_id,title:v.title,starts_at:new Date(v.starts_at).toISOString(),ends_at:new Date(v.ends_at).toISOString(),meeting_url:v.meeting_url||null});if(q.error)throw q.error;toast("Class session scheduled.");render(page)}),0);
 }
 const ses=await db().from("class_sessions").select("id,title,starts_at,meeting_url,class_sections(title,courses(title))").order("starts_at");if(ses.error)throw ses.error;
 const list=(ses.data||[]).map(x=>row(x.title+" · "+(x.class_sections?.courses?.title||x.class_sections?.title||""),date(x.starts_at),x.meeting_url?"MEETING LINK":"SESSION")).join("");
 return form+panel("Classes and scheduled sessions",list||empty("No class sessions scheduled yet."));
}
async function assignments(){
 if(profile.role==="student"){
  const r=await db().from("assignments").select("id,title,instructions,due_at,max_score").eq("is_published",true).order("due_at");if(r.error)throw r.error;
  const content=(r.data||[]).map(a=>'<article class="live-record"><h4>'+esc(a.title)+'</h4><p>'+esc(a.instructions)+'</p><small>Due '+esc(date(a.due_at))+' · Maximum score '+esc(a.max_score)+'</small><form class="live-form submissionForm" data-id="'+a.id+'"><label class="live-field">Your response<textarea name="text_response" required></textarea></label><label class="live-field">Attach a file (optional, up to 25 MB)<input name="attachment" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.mp3,.mp4,.txt"></label><button class="btn btn-green">Submit work</button></form></article>').join("")||empty("No published assignments.");
  setTimeout(()=>document.querySelectorAll(".submissionForm").forEach(f=>f.onsubmit=async e=>{e.preventDefault();const fd=new FormData(f),file=fd.get("attachment");let filePath=null;if(file&&file.size){if(file.size>26214400)throw Error("The attachment must be 25 MB or smaller.");const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");filePath="submissions/"+f.dataset.id+"/"+user.id+"/"+Date.now()+"_"+safe;const up=await db().storage.from("ruya-private").upload(filePath,file,{contentType:file.type||"application/octet-stream",upsert:false});if(up.error)throw up.error}const q=await db().from("submissions").upsert({assignment_id:f.dataset.id,student_id:user.id,text_response:fd.get("text_response"),file_path:filePath,status:"submitted"},{onConflict:"assignment_id,student_id"});if(q.error)toast(q.error.message);else{toast("Work submitted.");render(page)}}),0);
  return panel("Available assignments",content);
 }
 const s=profile.role==="management"?await db().from("class_sections").select("id,title,courses(title)"):await db().from("class_sections").select("id,title,courses(title)").eq("teacher_id",user.id);if(s.error)throw s.error;
 const r=await db().from("assignments").select("id,title,due_at,is_published").order("created_at",{ascending:false});if(r.error)throw r.error;
 let form=s.data.length?'<form class="live-form" id="assignmentForm"><label class="live-field">Class section<select name="section_id">'+s.data.map(x=>'<option value="'+x.id+'">'+esc(x.courses?.title||x.title)+' · '+esc(x.title)+'</option>').join("")+'</select></label>'+field("Assignment title","title")+field("Maximum score","max_score","number")+'<label class="live-field">Due date<input name="due_at" type="datetime-local"></label><label class="live-field">Instructions<textarea name="instructions"></textarea></label><label class="check-field"><input type="checkbox" name="is_published"> Publish now</label><button class="btn btn-green">Create assignment</button></form>':empty("Create a class section before assigning work.");
 setTimeout(()=>bind("assignmentForm",async f=>{const v=formData(f);const q=await db().from("assignments").insert({section_id:v.section_id,title:v.title,max_score:Number(v.max_score||100),due_at:v.due_at?new Date(v.due_at).toISOString():null,instructions:v.instructions||"",is_published:!!v.is_published,created_by:user.id});if(q.error)throw q.error;toast("Assignment created.");render(page)}),0);
 let grading="";
 const sub=await db().from("submissions").select("id,text_response,status,score,feedback,assignments(title,max_score),profiles!submissions_student_id_fkey(full_name,email)").order("submitted_at",{ascending:false});
 if(sub.error)throw sub.error;
 if(sub.data.length)grading=panel("Submissions and grading",sub.data.map(x=>'<article class="live-record"><h4>'+esc(x.assignments?.title||"Assignment")+' · '+esc(x.profiles?.full_name||x.profiles?.email||"Learner")+'</h4><p>'+esc(x.text_response)+'</p>'+(x.file_path?'<button class="activity-tag" data-download-path="'+esc(x.file_path)+'">OPEN ATTACHMENT</button>':"")+'<small>Status: '+esc(x.status)+'</small><form class="live-form gradeForm" data-id="'+x.id+'">'+field("Score (max "+(x.assignments?.max_score||100)+")","score","number")+'<label class="live-field">Feedback<textarea name="feedback">'+esc(x.feedback||"")+'</textarea></label><button class="btn btn-green">Save grade</button></form></article>').join(""));
 setTimeout(()=>document.querySelectorAll(".gradeForm").forEach(f=>f.onsubmit=async e=>{e.preventDefault();const v=formData(f);const q=await db().from("submissions").update({score:Number(v.score),feedback:v.feedback,status:"graded",graded_by:user.id,graded_at:new Date().toISOString()}).eq("id",f.dataset.id);if(q.error)toast(q.error.message);else{toast("Grade saved.");render(page)}}),0);
 return form+panel("Assignments",(r.data||[]).map(x=>row(x.title,"Due "+date(x.due_at),x.is_published?"PUBLISHED":"DRAFT")).join("")||empty("No assignments created."))+grading;
}
async function attendance(){
 const r=await db().from("attendance").select("status,marked_at,class_sessions(title,starts_at)").order("marked_at",{ascending:false}).limit(100);if(r.error)throw r.error;
 let form="";
 if(profile.role!=="student"){
  const [ss,ee]=await Promise.all([db().from("class_sessions").select("id,title,section_id,starts_at").order("starts_at",{ascending:false}),db().from("enrollments").select("section_id,student_id,profiles(full_name,email)").eq("status","active")]);
  if(ss.error)throw ss.error;if(ee.error)throw ee.error;
  const opts=[];
  ss.data.forEach(s=>ee.data.filter(e=>e.section_id===s.section_id).forEach(e=>opts.push('<option value="'+s.id+':'+e.student_id+'">'+esc(e.profiles?.full_name||e.profiles?.email||"Learner")+' · '+esc(s.title)+' · '+esc(date(s.starts_at))+'</option>')));
  form=opts.length?'<form class="live-form" id="attendanceForm"><label class="live-field">Learner and class session<select name="pair">'+opts.join("")+'</select></label><label class="live-field">Attendance status<select name="status"><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="excused">Excused</option></select></label><button class="btn btn-green">Save attendance</button></form>':empty("Create a class session and enroll learners before taking attendance.");
  setTimeout(()=>bind("attendanceForm",async f=>{const v=formData(f),parts=v.pair.split(":");const q=await db().from("attendance").upsert({session_id:parts[0],student_id:parts[1],status:v.status,marked_by:user.id},{onConflict:"session_id,student_id"});if(q.error)throw q.error;toast("Attendance saved.");render(page)}),0);
 }
 return form+panel("Attendance records",(r.data||[]).map(x=>row(x.class_sessions?.title||"Class session",date(x.class_sessions?.starts_at||x.marked_at),nice(x.status))).join("")||empty("No attendance records yet."));
}
async function library(){
 const r=await db().from("library_resources").select("*").order("created_at",{ascending:false});if(r.error)throw r.error;
 let form=profile.role!=="student"?'<form class="live-form" id="resourceForm">'+field("Resource title","title")+field("Category","category")+'<label class="live-field">Description<textarea name="description"></textarea></label><label class="live-field">External URL (optional)<input name="external_url" type="url"></label><label class="live-field">Or upload a file (up to 25 MB)<input name="resource_file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.mp3,.mp4,.txt"></label><label class="live-field">Visibility<select name="visibility"><option value="authenticated">All signed-in users</option><option value="staff">Staff only</option><option value="public">Public</option></select></label><button class="btn btn-green">Add resource</button></form>':"";
 setTimeout(()=>bind("resourceForm",async f=>{const v=formData(f),file=v.resource_file;let path=null;if(file&&file.size){if(file.size>26214400)throw Error("The file must be 25 MB or smaller.");const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");path="library/"+user.id+"/"+Date.now()+"_"+safe;const up=await db().storage.from("ruya-private").upload(path,file,{contentType:file.type||"application/octet-stream",upsert:false});if(up.error)throw up.error}if(!path&&!v.external_url)throw Error("Add an external URL or upload a file.");const q=await db().from("library_resources").insert({title:v.title,category:v.category,description:v.description||"",external_url:v.external_url||null,storage_path:path,visibility:v.visibility,uploaded_by:user.id,resource_type:path?"file":"link"});if(q.error)throw q.error;toast("Resource added.");render(page)}),0);
 const list=(r.data||[]).map(x=>'<div class="activity-row"><div class="activity-icon">▧</div><div class="activity-copy"><b>'+esc(x.title)+'</b><small>'+esc(x.category)+' · '+esc(x.description)+'</small></div>'+(x.external_url?'<a class="activity-tag" href="'+esc(x.external_url)+'" target="_blank" rel="noopener">OPEN ↗</a>':x.storage_path?'<button class="activity-tag" data-download-path="'+esc(x.storage_path)+'">DOWNLOAD</button>':'')+'</div>').join("");
 return form+panel("Learning library",list||empty("The library is waiting for its first resources."));
}
async function people(){
 const [r,s]=await Promise.all([db().from("profiles").select("id,email,full_name,role,is_active").order("created_at",{ascending:false}),db().from("class_sections").select("id,title,courses(title)")]);if(r.error)throw r.error;if(s.error)throw s.error;
 const students=r.data.filter(x=>x.role==="student"&&x.is_active);
 const form='<form class="live-form" id="enrollmentForm"><label class="live-field">Student<select name="student_id">'+students.map(x=>'<option value="'+x.id+'">'+esc(x.full_name||x.email)+'</option>').join("")+'</select></label><label class="live-field">Class section<select name="section_id">'+s.data.map(x=>'<option value="'+x.id+'">'+esc(x.courses?.title||x.title)+' · '+esc(x.title)+'</option>').join("")+'</select></label><button class="btn btn-green">Enroll student</button></form>';
 setTimeout(()=>bind("enrollmentForm",async f=>{const v=formData(f);const q=await db().from("enrollments").insert({student_id:v.student_id,section_id:v.section_id,status:"active"});if(q.error)throw q.error;toast("Student enrolled.");render(page)}),0);
 return form+panel("User directory",(r.data||[]).map(x=>'<div class="activity-row"><div class="activity-copy"><b>'+esc(x.full_name||"New member")+'</b><small>'+esc(x.email)+'</small></div><select class="role-select" data-role-id="'+x.id+'"><option value="student" '+(x.role==="student"?"selected":"")+'>Student</option><option value="teacher" '+(x.role==="teacher"?"selected":"")+'>Teacher</option><option value="management" '+(x.role==="management"?"selected":"")+'>Management</option></select><button class="btn btn-outline" data-active-id="'+x.id+'" data-active="'+x.is_active+'">'+(x.is_active?"Active":"Inactive")+'</button></div>').join("")||empty("No users yet."));
}
async function announcements(){
 const r=await db().from("announcements").select("*").order("created_at",{ascending:false});if(r.error)throw r.error;
 const form=profile.role==="management"?'<form class="live-form" id="announceForm">'+field("Title","title")+'<label class="live-field">Announcement<textarea name="body" required></textarea></label><label class="live-field">Audience<select name="audience"><option value="all">Everyone</option><option value="student">Students</option><option value="teacher">Teachers</option></select></label><button class="btn btn-green">Publish</button></form>':"";
 setTimeout(()=>bind("announceForm",async f=>{const v=formData(f);const q=await db().from("announcements").insert({title:v.title,body:v.body,audience:v.audience==="all"?null:[v.audience],published_at:new Date().toISOString(),created_by:user.id});if(q.error)throw q.error;toast("Announcement published.");render(page)}),0);
 return form+panel("Announcements",(r.data||[]).map(x=>'<article class="live-record"><h4>'+esc(x.title)+'</h4><p>'+esc(x.body)+'</p><small>'+esc(date(x.published_at||x.created_at))+'</small></article>').join("")||empty("No announcements."));
}
async function messages(){
 const [r,u]=await Promise.all([db().from("messages").select("*").order("created_at",{ascending:false}),db().rpc("get_message_recipients")]);if(r.error)throw r.error;if(u.error)throw u.error;
 const form='<form class="live-form" id="messageForm"><label class="live-field">Recipient<select name="recipient_id">'+u.data.map(x=>'<option value="'+x.id+'">'+esc(x.full_name||nice(x.role))+' · '+esc(x.role)+'</option>').join("")+'</select></label>'+field("Subject","subject")+'<label class="live-field">Message<textarea name="body" required></textarea></label><button class="btn btn-green">Send message</button></form>';
 setTimeout(()=>bind("messageForm",async f=>{const v=formData(f);const q=await db().from("messages").insert({sender_id:user.id,recipient_id:v.recipient_id,subject:v.subject,body:v.body});if(q.error)throw q.error;toast("Message sent.");render(page)}),0);
 return form+panel("Inbox and sent messages",(r.data||[]).map(x=>'<article class="live-record"><h4>'+esc(x.subject||"Message")+'</h4><p>'+esc(x.body)+'</p><small>'+(x.sender_id===user.id?"Sent":"Received")+' · '+esc(date(x.created_at))+'</small></article>').join("")||empty("No messages."));
}
async function records(){
 const [a,b,c]=await Promise.all([db().from("attendance").select("id"),db().from("submissions").select("id"),db().from("enrollments").select("id")]);for(const x of [a,b,c])if(x.error)throw x.error;
 return panel("Academic records summary",'<div class="workspace-stats"><div class="workspace-stat"><div class="stat-top">Attendance entries</div><strong>'+a.data.length+'</strong></div><div class="workspace-stat"><div class="stat-top">Submissions</div><strong>'+b.data.length+'</strong></div><div class="workspace-stat"><div class="stat-top">Enrollments</div><strong>'+c.data.length+'</strong></div></div>');
}
document.addEventListener("click",async e=>{
 const file=e.target.closest("[data-download-path]");if(file){const signed=await db().storage.from("ruya-private").createSignedUrl(file.dataset.downloadPath,60);if(signed.error)toast(signed.error.message);else window.open(signed.data.signedUrl,"_blank","noopener");return}
 const r=e.target.closest("[data-role-id]");if(r){const q=await db().from("profiles").update({role:r.value}).eq("id",r.dataset.roleId);toast(q.error?q.error.message:"Role updated.");return}
 const a=e.target.closest("[data-active-id]");if(a){const q=await db().from("profiles").update({is_active:a.dataset.active!=="true"}).eq("id",a.dataset.activeId);if(q.error)toast(q.error.message);else render(page)}
});
async function signOut(){if(db())await db().auth.signOut();$("authPassword").value="";user=null;profile=null;$("dashboard").classList.remove("show");$("publicSite").style.display="block";window.scrollTo(0,0)}
window.ruyaNavigate=render;window.ruyaSignIn=signin;window.ruyaSignUp=signupAction;window.ruyaShowLogin=openLogin;window.ruyaCloseLogin=close;window.ruyaSignOut=signOut;window.ruyaResetPassword=resetPassword;window.ruyaAuthSwitch=()=>mode($("authSwitch").dataset.mode||"signup");
document.addEventListener("DOMContentLoaded",async()=>{
 $("year").textContent=new Date().getFullYear();$("loginModal").addEventListener("click",e=>{if(e.target===$("loginModal"))close()});
 if(!db()){const n=document.querySelector(".backend-status");if(n)n.textContent="Backend setup required";return}
 const r=await db().auth.getSession();if(r.data.session){try{await loadProfile(r.data.session.user)}catch(e){toast(e.message)}}
 db().auth.onAuthStateChange((event)=>{if(event==="SIGNED_OUT"){user=null;profile=null;$("dashboard").classList.remove("show");$("publicSite").style.display="block"}});
});
})();