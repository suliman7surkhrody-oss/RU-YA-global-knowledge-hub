(function(){
"use strict";
const $=id=>document.getElementById(id), db=()=>window.ruyaSupabase;
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const nice=s=>String(s||"").replace(/[_-]/g," ").replace(/\b\w/g,c=>c.toUpperCase());
let user=null,profile=null,page="Overview";
const menus={student:["Overview","GED study plan","Live classes","Assignments","Attendance","GED library","Community chat","Fees & payments","Notifications","Announcements","Messages"],teacher:["Overview","My GED classes","Teaching schedule","Assignments & grading","Attendance register","GED learning resources","Community chat","Notifications","Announcements","Messages"],management:["Overview","GED programs","People & roles","Timetables","Academic records","GED library","Community chat","Fees & payments","Notifications","Announcements","Messages"]};
function toast(s){const e=$("toast");e.textContent=s;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),3200)}
let authSignup=false,authReturnFocus=null,recoveryMode=false,pendingPage=null;
function close(){ $("loginModal").classList.remove("show");$("authPassword").value="";$("authError").textContent="";if(authReturnFocus&&typeof authReturnFocus.focus==="function")authReturnFocus.focus(); }
function authErrorMessage(e){const m=String(e&&e.message||"").toLowerCase();if(m.includes("invalid login credentials"))return "The email address or password is incorrect. Check both and try again.";if(m.includes("email not confirmed"))return "Please confirm your email address using the link sent to your inbox.";if(m.includes("user already registered"))return "An account with this email already exists. Please sign in instead.";if(m.includes("password should be at least"))return "For a new account, choose a password with at least 8 characters.";return e&&e.message?e.message:"Authentication failed. Please try again.";}
function mode(m){authSignup=m==="signup";recoveryMode=m==="recovery";$("authNameWrap").hidden=!authSignup;$("authName").required=authSignup;$("authPassword").autocomplete=authSignup||recoveryMode?"new-password":"current-password";$("authPassword").minLength=authSignup||recoveryMode?8:1;$("authPassword").placeholder=authSignup||recoveryMode?"At least 8 characters":"Your password";$("authModeTitle").textContent=recoveryMode?"Choose a new password":authSignup?"Create your student account":"Welcome back";$("authSubmit").textContent=recoveryMode?"Update password":authSignup?"Create account":"Sign in";$("authSwitch").hidden=recoveryMode;$("forgotPassword").hidden=recoveryMode;$("authHint").textContent=recoveryMode?"Choose a new password for your AUREVIA account.":"New registrations receive student access only. AUREVIA management assigns teacher and management permissions after verifying staff identity.";$("authSwitch").textContent=authSignup?"Already registered? Sign in":"Create a student account";$("authSwitch").dataset.mode=authSignup?"signin":"signup";$("authSwitch").onclick=()=>mode(authSignup?"signin":"signup");$("authError").textContent="";}
function openLogin(initialMode){authReturnFocus=document.activeElement;$("loginModal").classList.add("show");mode(initialMode==="signup"?"signup":"signin");setTimeout(()=>$("authEmail").focus(),50)}
async function signin(){return authenticate(false)}
async function signupAction(){return authenticate(true)}
async function authenticate(signup){
 if(!db())return $("authError").textContent="AUREVIA account services are not connected yet. Registration and sign-in will become available after the organisation activates its secure account system.";
 if(recoveryMode){
  const password=$("authPassword").value;
  if(password.length<8)return $("authError").textContent="Choose a password with at least 8 characters.";
  $("authSubmit").disabled=true;$("authError").textContent="";
  try{const r=await db().auth.updateUser({password});if(r.error)throw r.error;await db().auth.signOut();$("authEmail").value="";$("authPassword").value="";mode("signin");$("authError").textContent="Your password has been updated. You can now sign in with your new password."}
  catch(e){$("authError").textContent=authErrorMessage(e)}
  finally{$("authSubmit").disabled=false}
  return;
 }
 const email=$("authEmail").value.trim(),password=$("authPassword").value;
 if(!email||!password)return $("authError").textContent="Enter your email address and password.";if(signup&&password.length<8)return $("authError").textContent="For a new account, use a password with at least 8 characters.";
 $("authSubmit").disabled=true;$("authError").textContent="";
 try{
  let result;
  if(signup){const name=$("authName").value.trim();if(!name)throw Error("Enter your full name.");result=await db().auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:location.origin+location.pathname}});}
  else result=await db().auth.signInWithPassword({email,password});
  if(result.error)throw result.error;
  if(result.data.session){try{await loadProfile(result.data.user);close()}catch(profileError){await db().auth.signOut();user=null;profile=null;$("dashboard").classList.remove("show");$("publicSite").style.display="block";throw new Error("Your account was authenticated, but its AUREVIA profile could not be opened. Please contact management or try again. "+(profileError.message||""))}}
  else {mode("signin");$("authError").textContent="Your account has been created. Check your inbox (and spam folder) to confirm your email, then return here to sign in."; }
 }catch(e){$("authError").textContent=authErrorMessage(e)}
 finally{$("authSubmit").disabled=false}
}
async function resetPassword(){const email=$("authEmail").value.trim();if(!db()){$("authError").textContent="Password recovery is currently unavailable because AUREVIA has not connected its secure account service. Please contact the organisation’s administrator.";return}if(!email){$("authError").textContent="Enter your account email address first."; $("authEmail").focus();return}const redirectTo=location.origin+location.pathname+"?auth=recovery";const r=await db().auth.resetPasswordForEmail(email,{redirectTo});$("authError").textContent=r.error?"We could not send the reset email: "+r.error.message:"If an account exists for this address, password-reset instructions have been sent. Check your inbox and spam folder.";}
async function loadProfile(u){
 const r=await db().from("profiles").select("*").eq("id",u.id).single();if(r.error)throw r.error;
 if(!r.data.is_active){await db().auth.signOut();throw Error("This account is inactive. Contact AUREVIA management.")}
 user=u;profile=r.data;setupNotificationRealtime();$("publicSite").style.display="none";$("dashboard").classList.add("show");
 $("roleLabel").textContent=nice(profile.role)+" workspace";$("dashUserName").textContent=profile.full_name||u.email;$("dashUserEmail").textContent=u.email;
 $("previewNote").textContent="SECURE WORKSPACE · "+u.email;const destination=pendingPage||"Overview";pendingPage=null;await render(destination);window.scrollTo(0,0)
}
function nav(){ $("workspaceNav").innerHTML=(menus[profile.role]||[]).map(n=>'<button class="workspace-nav '+(page===n?"active":"")+'" onclick="ruyaNavigate(\''+n.replace(/'/g,"\\'")+'\')"><span class="nav-ico">◆</span>'+esc(n)+'</button>').join("")}
function shell(title,desc,body){return '<div class="workspace-topline"><div class="eyebrow">AUREVIA · '+esc(nice(profile.role))+' WORKSPACE</div><h1>'+esc(title)+'</h1><p class="welcome-sub">'+esc(desc)+'</p></div><div class="live-content">'+body+'</div>'}
function panel(title,body){return '<section class="workspace-card"><div class="card-heading"><h3>'+esc(title)+'</h3></div>'+(body||'<p class="empty-state">No records yet.</p>')+'</section>'}
function date(v){return v?new Date(v).toLocaleString([],{dateStyle:"medium",timeStyle:"short"}):"Not scheduled"}
function row(title,sub,tag){return '<div class="activity-row"><div class="activity-icon">◆</div><div class="activity-copy"><b>'+esc(title)+'</b><small>'+esc(sub)+'</small></div><span class="activity-tag">'+esc(tag||"")+'</span></div>'}
function empty(s){return '<p class="empty-state">'+esc(s)+'</p>'}
function field(label,name,type){const t=type||"text";return '<label class="live-field">'+esc(label)+'<input name="'+name+'" type="'+t+'"'+(t==="number"?' step="0.01" min="0"':"")+' required></label>'}
function formData(f){const o={};new FormData(f).forEach((v,k)=>o[k]=v);return o}
function bind(id,fn){const f=$(id);if(f)f.onsubmit=async e=>{e.preventDefault();try{await fn(f)}catch(x){toast(x.message||"Action failed.")}}}
async function render(p){
 if(p!=="Community chat"&&communityChannel){db().removeChannel(communityChannel);communityChannel=null;}page=p;nav();$("dashContent").innerHTML=shell(p,"Loading secure institutional records…",'<p class="loading-line">Connecting…</p>');
 try{
  let b="";
  if(p==="Overview")b=await overview();
  else if(["My courses","GED study plan","Academic programs","GED programs"].includes(p))b=await courses();
  else if(["Class schedule","Live classes","Teaching schedule","Timetables","My classes","My GED classes"].includes(p))b=await classes();
  else if(["Assignments","Assignments & grading"].includes(p))b=await assignments();
  else if(["Attendance","Attendance register"].includes(p))b=await attendance();
  else if(["Learning library","GED library","Learning resources","GED learning resources","Resources"].includes(p))b=await library();
  else if(p==="People & roles")b=await people();
  else if(p==="Announcements")b=await announcements();
  else if(p==="Messages")b=await messages();
  else if(p==="Community chat")b=await communityChat();
  else if(p==="Fees & payments")b=await fees();
  else if(p==="Notifications")b=await notifications();
  else b=await records();
  $("dashContent").innerHTML=shell(p,"Live data from the AUREVIA academic workspace.",b);
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
 return '<div class="portal-hero"><small>SECURE AUREVIA WORKSPACE</small><h2>Welcome, '+esc(profile.full_name||"AUREVIA member")+'.</h2><p>Your account is connected. Information shown here is restricted by your role.</p></div><div class="workspace-stats">'+stats.map(x=>'<div class="workspace-stat"><div class="stat-top">'+esc(x[0])+'</div><strong>'+x[1]+'</strong><small>Live database count</small></div>').join("")+'</div>'+panel("Recent activity",activity||empty("No activity yet."));
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
 if(profile.role==="student"){const q=await db().from("enrollments").select("class_sections(id,title,starts_at,meeting_url,courses(title))").eq("student_id",user.id).eq("status","active");if(q.error)throw q.error;sections=(q.data||[]).map(x=>x.class_sections).filter(Boolean)}
 else{const q=profile.role==="management"?await db().from("class_sections").select("id,title,starts_at,meeting_url,courses(title)"):await db().from("class_sections").select("id,title,starts_at,meeting_url,courses(title)").eq("teacher_id",user.id);if(q.error)throw q.error;sections=q.data||[]}
 let form="";
 if(profile.role==="management"){const [cs,ts]=await Promise.all([db().from("courses").select("id,title").order("title"),db().from("profiles").select("id,full_name,email").eq("role","teacher").eq("is_active",true)]);if(cs.error)throw cs.error;if(ts.error)throw ts.error;form='<form class="live-form" id="sectionForm"><h3>Create a class</h3><label class="live-field">Course<select name="course_id" required>'+cs.data.map(x=>'<option value="'+x.id+'">'+esc(x.title)+'</option>').join("")+'</select></label><label class="live-field">Assigned teacher<select name="teacher_id"><option value="">Unassigned</option>'+ts.data.map(x=>'<option value="'+x.id+'">'+esc(x.full_name||x.email)+'</option>').join("")+'</select></label>'+field("Class / section name","title")+'<label class="live-field">Default meeting link (optional)<input name="meeting_url" type="url" placeholder="https://meet.google.com/..."></label><button class="btn btn-green">Create class</button></form>';setTimeout(()=>bind("sectionForm",async f=>{const v=formData(f);const q=await db().from("class_sections").insert({course_id:v.course_id,teacher_id:v.teacher_id||null,title:v.title,meeting_url:v.meeting_url||null});if(q.error)throw q.error;toast("Class created. Enrol learners before scheduling its sessions.");render(page)}),0)}
 if(profile.role==="teacher"||profile.role==="management"){const opts=sections.map(x=>'<option value="'+x.id+'">'+esc(x.courses?.title||x.title)+' · '+esc(x.title)+'</option>').join("");form+='<form class="live-form" id="sessionForm"><h3>Schedule a live lesson</h3><label class="live-field">Class section<select name="section_id" required>'+opts+'</select></label>'+field("Lesson / session title","title")+'<div class="form-pair"><label class="live-field">Start date and time<input name="starts_at" type="datetime-local" required></label><label class="live-field">End date and time<input name="ends_at" type="datetime-local" required></label></div><label class="live-field">Video platform<select name="video_provider"><option value="google_meet">Google Meet</option><option value="jitsi">Jitsi Meet</option><option value="zoom">Zoom</option><option value="microsoft_teams">Microsoft Teams</option><option value="external">Other video link</option></select></label><label class="live-field">Meeting URL<input name="meeting_url" type="url" placeholder="Paste the meeting link from your video platform" required></label><label class="live-field">Lesson notes / instructions<textarea name="notes" rows="3" placeholder="What students should prepare before joining"></textarea></label><div class="form-pair"><label class="live-field">Slides / lesson materials URL<input name="materials_url" type="url" placeholder="Optional"></label><label class="live-field">Recording URL<input name="recording_url" type="url" placeholder="Add after the lesson"></label></div><label class="live-field">Reminder before class<select name="reminder_minutes_before"><option value="5">5 minutes</option><option value="15" selected>15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="1440">1 day</option></select></label><label class="check-field"><input type="checkbox" name="is_published" checked> Publish this session to enrolled learners</label><p class="record-note">Times use your device local time. For Google Meet, create the meeting in Meet or Calendar, then paste its link here.</p><button class="btn btn-green">Schedule and publish class</button></form>';setTimeout(()=>bind("sessionForm",async f=>{const v=formData(f),starts=new Date(v.starts_at),ends=new Date(v.ends_at);if(!(ends>starts))throw Error("The class end time must be after its start time.");if(!/^https:\/\//i.test(v.meeting_url))throw Error("Use a secure HTTPS meeting link.");const q=await db().from("class_sessions").insert({section_id:v.section_id,title:v.title,starts_at:starts.toISOString(),ends_at:ends.toISOString(),meeting_url:v.meeting_url,video_provider:v.video_provider,notes:v.notes||"",materials_url:v.materials_url||null,recording_url:v.recording_url||null,reminder_minutes_before:Number(v.reminder_minutes_before||15),is_published:!!v.is_published});if(q.error)throw q.error;toast("Class session scheduled.");render(page)}),0)}
 let query=db().from("class_sessions").select("id,title,starts_at,ends_at,meeting_url,video_provider,notes,materials_url,recording_url,is_published,reminder_minutes_before,class_sections(title,courses(title))").order("starts_at",{ascending:true});if(profile.role==="student")query=query.eq("is_published",true);const ses=await query;if(ses.error)throw ses.error;
 const providers={google_meet:"Google Meet",jitsi:"Jitsi Meet",zoom:"Zoom",microsoft_teams:"Microsoft Teams",external:"Online meeting"};
 const list=(ses.data||[]).map(x=>{const upcoming=new Date(x.ends_at)>=new Date();const join=x.meeting_url?'<a class="btn btn-green" href="'+esc(x.meeting_url)+'" target="_blank" rel="noopener noreferrer">Join live class ↗</a>':'<span class="activity-tag">Meeting link not added</span>';const links=(x.materials_url?'<a class="activity-tag" href="'+esc(x.materials_url)+'" target="_blank" rel="noopener noreferrer">LESSON MATERIALS ↗</a>':"")+(x.recording_url?'<a class="activity-tag" href="'+esc(x.recording_url)+'" target="_blank" rel="noopener noreferrer">WATCH RECORDING ↗</a>':"");const staff=profile.role!=="student"?'<button class="activity-tag" data-delete-session="'+x.id+'">CANCEL SESSION</button>':"";return '<article class="live-record session-card"><div class="fee-head"><div><span class="activity-tag">'+(upcoming?"UPCOMING":"COMPLETED")+'</span><h4>'+esc(x.title)+'</h4><small>'+esc(x.class_sections?.courses?.title||x.class_sections?.title||"Class")+' · '+esc(providers[x.video_provider]||"Online")+'</small></div><div class="session-time"><b>'+esc(date(x.starts_at))+'</b><small>Ends '+esc(date(x.ends_at))+'</small></div></div>'+(x.notes?'<p>'+esc(x.notes)+'</p>':"")+'<div class="dash-actions">'+(upcoming?join:"")+' '+links+' '+staff+'</div></article>'}).join("");
 const hint=profile.role==="student"?'<p class="record-note">Join the class using its secure meeting link. Your teacher may also share slides and a recording here.</p>':'<p class="record-note">Create classes, assign teachers, schedule live lessons and share the meeting link, lesson materials and recordings with enrolled students.</p>';
 return form+panel("Online classroom",hint+(list||empty("No class sessions scheduled yet.")));
}
async function assignments(){
 if(profile.role==="student"){
  const r=await db().from("assignments").select("id,title,instructions,due_at,max_score,submissions(id,status,score,feedback)").eq("is_published",true).order("due_at");if(r.error)throw r.error;
  const content=(r.data||[]).map(a=>'<article class="live-record"><h4>'+esc(a.title)+'</h4><p>'+esc(a.instructions)+'</p><small>Due '+esc(date(a.due_at))+' · Maximum score '+esc(a.max_score)+'</small><form class="live-form submissionForm" data-id="'+a.id+'"><label class="live-field">Your response<textarea name="text_response" required></textarea></label><label class="live-field">Attach a file (optional, up to 25 MB)<input name="attachment" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.mp3,.mp4,.txt"></label><button class="btn btn-green">Submit work</button></form><p class="record-note">'+(a.submissions||[]).map(x=>esc(nice(x.status))+" · Score: "+esc(x.score==null?"Pending":x.score)+" · "+esc(x.feedback||"")).join(" | ")+'</p></article>').join("")||empty("No published assignments.");
  setTimeout(()=>document.querySelectorAll(".submissionForm").forEach(f=>f.onsubmit=async e=>{e.preventDefault();const button=f.querySelector("button");if(button)button.disabled=true;try{const fd=new FormData(f),file=fd.get("attachment");let filePath=null;if(file&&file.size){if(file.size>26214400)throw Error("The attachment must be 25 MB or smaller.");const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");filePath="submissions/"+f.dataset.id+"/"+user.id+"/"+Date.now()+"_"+safe;const up=await db().storage.from("ruya-private").upload(filePath,file,{contentType:file.type||"application/octet-stream",upsert:false});if(up.error)throw up.error}const q=await db().from("submissions").upsert({assignment_id:f.dataset.id,student_id:user.id,text_response:fd.get("text_response"),file_path:filePath,status:"submitted"},{onConflict:"assignment_id,student_id"});if(q.error)throw q.error;toast("Work submitted.");render(page)}catch(x){toast(x.message||"Could not submit work.");if(button)button.disabled=false}}),0);
  return panel("Available assignments",content);
 }
 const s=profile.role==="management"?await db().from("class_sections").select("id,title,courses(title)"):await db().from("class_sections").select("id,title,courses(title)").eq("teacher_id",user.id);if(s.error)throw s.error;
 const r=await db().from("assignments").select("id,title,due_at,is_published").order("created_at",{ascending:false});if(r.error)throw r.error;
 let form=s.data.length?'<form class="live-form" id="assignmentForm"><label class="live-field">Class section<select name="section_id">'+s.data.map(x=>'<option value="'+x.id+'">'+esc(x.courses?.title||x.title)+' · '+esc(x.title)+'</option>').join("")+'</select></label>'+field("Assignment title","title")+field("Maximum score","max_score","number")+'<label class="live-field">Due date<input name="due_at" type="datetime-local"></label><label class="live-field">Instructions<textarea name="instructions"></textarea></label><label class="check-field"><input type="checkbox" name="is_published"> Publish now</label><button class="btn btn-green">Create assignment</button></form>':empty("Create a class section before assigning work.");
 setTimeout(()=>bind("assignmentForm",async f=>{const v=formData(f);const q=await db().from("assignments").insert({section_id:v.section_id,title:v.title,max_score:Number(v.max_score||100),due_at:v.due_at?new Date(v.due_at).toISOString():null,instructions:v.instructions||"",is_published:!!v.is_published,created_by:user.id});if(q.error)throw q.error;toast("Assignment created.");render(page)}),0);
 let grading="";
 const sub=await db().from("submissions").select("id,text_response,file_path,status,score,feedback,assignments(title,max_score),profiles!submissions_student_id_fkey(full_name,email)").order("submitted_at",{ascending:false});
 if(sub.error)throw sub.error;
 if(sub.data.length)grading=panel("Submissions and grading",sub.data.map(x=>'<article class="live-record"><h4>'+esc(x.assignments?.title||"Assignment")+' · '+esc(x.profiles?.full_name||x.profiles?.email||"Learner")+'</h4><p>'+esc(x.text_response)+'</p>'+(x.file_path?'<button class="activity-tag" data-download-path="'+esc(x.file_path)+'">OPEN ATTACHMENT</button>':"")+'<small>Status: '+esc(x.status)+'</small><form class="live-form gradeForm" data-id="'+x.id+'">'+field("Score (max "+(x.assignments?.max_score||100)+")","score","number")+'<label class="live-field">Feedback<textarea name="feedback">'+esc(x.feedback||"")+'</textarea></label><button class="btn btn-green">Save grade</button></form></article>').join(""));
 setTimeout(()=>document.querySelectorAll(".gradeForm").forEach(f=>f.onsubmit=async e=>{e.preventDefault();const button=f.querySelector("button[type=submit],button:not([type])");if(button)button.disabled=true;try{const v=formData(f),score=Number(v.score);if(!Number.isFinite(score)||score<0||score>Number(f.querySelector('[name="score"]').max||100))throw Error("Enter a valid score within the assignment's maximum.");const q=await db().from("submissions").update({score,feedback:v.feedback,status:"graded",graded_by:user.id,graded_at:new Date().toISOString()}).eq("id",f.dataset.id);if(q.error)throw q.error;toast("Grade saved.");render(page)}catch(x){toast(x.message||"Could not save grade.");if(button)button.disabled=false}}),0);
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

let communityChannel=null,notificationChannel=null,browserNotificationsEnabled=false;

async function showPublicSubject(subjectId){
 const box=$("gedPublicLessons");if(!box)return;
 box.hidden=false;box.innerHTML='<p class="empty-state">Loading published lessons…</p>';
 const r=await db().from("ged_lessons").select("id,title_en,title_dari,summary_en,summary_dari,content_en,content_dari,estimated_minutes,resource_url").eq("subject_id",subjectId).eq("is_published",true).order("sort_order");
 if(r.error){box.innerHTML='<p class="empty-state">'+esc(r.error.message)+'</p>';return}
 box.innerHTML='<div class="public-lesson-head"><h3>Open lessons</h3><button class="activity-tag" type="button" onclick="document.getElementById(\'gedPublicLessons\').hidden=true">Close</button></div>'+(r.data||[]).map(x=>'<article class="public-lesson"><h4><span class="en">'+esc(x.title_en)+'</span><span class="prs">'+esc(x.title_dari)+'</span></h4><p><span class="en">'+esc(x.summary_en)+'</span><span class="prs">'+esc(x.summary_dari)+'</span></p><div class="lesson-content"><span class="en">'+esc(x.content_en).replace(/\\n/g,"<br>")+'</span><span class="prs">'+esc(x.content_dari).replace(/\\n/g,"<br>")+'</span></div><small>'+esc(x.estimated_minutes)+' min</small>'+(x.resource_url?'<a href="'+esc(x.resource_url)+'" target="_blank" rel="noopener">Open lesson ↗</a>':"")+'</article>').join("")||'<p class="empty-state">Lessons for this subject are being prepared. Please check again soon.</p>';
 box.scrollIntoView({behavior:"smooth",block:"start"});
}
const AUREVIA_LIBRARY_SOURCES=[
 {title:"Darakht-e Danesh Open Library",description:"Afghanistan-focused open educational resources, books, lesson plans and learning materials across school and professional subjects.",languages:["English","Dari","Pashto"],category:"Education",url:"https://darakhtdanesh.org/en/library/",meta:"9,000+ resources · 127 subjects · open education"},
 {title:"Project Gutenberg",description:"A large collection of public-domain ebooks, especially classic literature, history, philosophy and reference works.",languages:["English"],category:"Literature",url:"https://www.gutenberg.org/",meta:"79,000+ free ebooks · read and download"},
 {title:"OpenStax",description:"Peer-reviewed, openly licensed textbooks for mathematics, science, social sciences, humanities and business.",languages:["English"],category:"Education",url:"https://openstax.org/subjects",meta:"Free online textbooks and PDF downloads"},
 {title:"OEAC Digital Library",description:"A broad catalogue with Afghan literature, Pashto and Dari/Persian books, science, technology and Islamic-studies collections. Check each title's rights and source.",languages:["English","Dari","Pashto","Persian","Arabic"],category:"Reference",url:"https://library.oeacnetwork.com/",meta:"15,000+ catalogue entries · multiple languages"},
 {title:"Afghan Youth Parliament Resource Library",description:"Curated educational and cultural resources, including Afghan history, Dari and Pashto literature, science and learning materials.",languages:["English","Dari","Pashto"],category:"History",url:"https://aypfrs.net/resource-library/",meta:"Curated Afghanistan-focused resources"},
 {title:"Arthur Paul Afghanistan Collection",description:"University research collection with more than 20,000 titles and materials in over 20 languages, including Dari and Pashto.",languages:["English","Dari","Pashto","Uzbek"],category:"History",url:"https://digitalcommons.unomaha.edu/daripashtobooks/",meta:"20,000+ titles · research collection"},
 {title:"Afghanistan Digital Library · NYU",description:"Digitised Afghan publications and historical materials; availability and reuse conditions vary by item.",languages:["English","Dari","Pashto"],category:"History",url:"https://afghanistandl.nyu.edu/",meta:"Historical Afghan publications"},
 {title:"Wikisource",description:"A multilingual free library of texts and works that are in the public domain or shared under compatible free licences.",languages:["English","Dari","Pashto","Persian","Uzbek"],category:"Literature",url:"https://wikisource.org/",meta:"Multilingual free text library"},
 {title:"QuranEnc",description:"Qur'an translations and downloadable translation files, including Uzbek translations. Review the translator and edition.",languages:["Arabic","Dari","Pashto","Uzbek","Persian","English"],category:"Islamic",url:"https://quranenc.com/en/home",meta:"Qur'an translations · downloadable formats"},
 {title:"Open Library",description:"A global book catalogue with reading and controlled digital lending options; access depends on the title and lending rights.",languages:["English","Dari","Pashto","Persian","Uzbek"],category:"Reference",url:"https://openlibrary.org/",meta:"Global book catalogue"},
 {title:"Internet Archive · Texts",description:"Digitised books and texts from libraries and partner collections. Some titles are downloadable; others are controlled digital loans.",languages:["English","Dari","Pashto","Persian","Uzbek"],category:"Reference",url:"https://archive.org/details/texts",meta:"Large digital archive · item-level access rules"},
 {title:"Library of Congress · Country Studies",description:"Reference works on the history, society, geography and institutions of countries, including Afghanistan.",languages:["English"],category:"History",url:"https://www.loc.gov/collections/country-studies/",meta:"Research and country reference"}
];
function aureviaFilterLibrary(){
 const q=(document.getElementById("librarySearch")?.value||"").trim().toLowerCase();
 const lang=document.getElementById("libraryLanguage")?.value||"";
 const cat=document.getElementById("libraryCategory")?.value||"";
 const grid=document.getElementById("librarySourceGrid");if(!grid)return;
 const filtered=AUREVIA_LIBRARY_SOURCES.filter(x=>(!q||(x.title+" "+x.description+" "+x.category+" "+x.languages.join(" ")).toLowerCase().includes(q))&&(!lang||x.languages.includes(lang))&&(!cat||x.category===cat));
 grid.innerHTML=filtered.map(x=>'<a class="library-source" href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer"><span class="source-meta">'+esc(x.meta)+'</span><b>'+esc(x.title)+'</b><small>'+esc(x.description)+'</small><small>Languages: '+esc(x.languages.join(" · "))+'</small><span class="source-meta">OPEN COLLECTION ↗</span></a>').join("")||'<p class="empty-state">No collections match these filters. Try another language or subject.</p>';
}
window.aureviaFilterLibrary=aureviaFilterLibrary;
async function loadPublicGedCatalog(){
 if(!db())return;
 aureviaFilterLibrary();
 const [s,l]=await Promise.all([
  db().from("ged_subjects").select("id,code,title_en,title_dari,summary_en,summary_dari,exam_duration_minutes,topics").eq("is_published",true).order("sort_order"),
  db().from("library_resources").select("id,title,description,category,external_url,resource_type").eq("visibility","public").order("created_at",{ascending:false}).limit(1000)
 ]);
 const grid=$("gedSubjectGrid");
 if(grid){
  if(s.error)grid.innerHTML='<p class="empty-state">The GED catalogue is temporarily unavailable.</p>';
  else grid.innerHTML=(s.data||[]).map(x=>'<article class="ged-subject-card"><div class="subject-code">'+esc(x.code)+'</div><h3><span class="en">'+esc(x.title_en)+'</span><span class="prs">'+esc(x.title_dari)+'</span></h3><p><span class="en">'+esc(x.summary_en)+'</span><span class="prs">'+esc(x.summary_dari)+'</span></p><div class="subject-meta">'+esc(x.exam_duration_minutes)+' minutes · '+esc((x.topics||[]).length)+' topic groups</div><button class="btn btn-green" type="button" data-public-subject="'+x.id+'">Explore subject ↗</button></article>').join("")||'<p class="empty-state">GED subjects are being prepared.</p>';
 }
 const library=$("publicLibraryResources");
 if(library){
  if(l.error)library.innerHTML='<p class="empty-state">Public resources are temporarily unavailable.</p>';
  else library.innerHTML=(l.data||[]).filter(x=>x.external_url).map(x=>'<a class="public-resource" href="'+esc(x.external_url)+'" target="_blank" rel="noopener"><b>'+esc(x.title)+'</b><small>'+esc(x.category)+' · '+esc(x.description)+'</small><span>Open ↗</span></a>').join("")||'<p class="empty-state">Open learning resources will appear here as they are published.</p>';
 }
}

async function communityChat(){
 const r=await db().from("community_messages").select("id,body,created_at,sender_id,profiles!community_messages_sender_id_fkey(full_name,role)").eq("room_key","general").is("deleted_at",null).order("created_at",{ascending:false}).limit(80);
 if(r.error)throw r.error;
 const messages=(r.data||[]).reverse().map(m=>'<article class="chat-message '+(m.sender_id===user.id?'mine':'')+'"><div class="chat-meta"><b>'+esc(m.profiles?.full_name||"AUREVIA learner")+'</b><span>'+esc(nice(m.profiles?.role||"student"))+' · '+esc(date(m.created_at))+'</span></div><p>'+esc(m.body)+'</p></article>').join("")||empty("No messages yet. Start the conversation.");
 if(!communityChannel){
  communityChannel=db().channel("aurevia-community-general").on("postgres_changes",{event:"INSERT",schema:"public",table:"community_messages",filter:"room_key=eq.general"},()=>{if(page==="Community chat")render("Community chat")}).subscribe();
 }
 const body='<div class="community-chat"><div class="chat-feed" id="communityFeed">'+messages+'</div><form class="chat-compose" id="communityForm"><textarea name="body" maxlength="3000" rows="2" placeholder="Write a respectful message to the GED community…" required></textarea><button class="btn btn-green" type="submit">Send</button></form><small class="chat-guideline">Be respectful. Do not share passwords, private information or copyrighted books.</small></div>';
 setTimeout(()=>bind("communityForm",async f=>{const v=formData(f);const q=await db().from("community_messages").insert({room_key:"general",sender_id:user.id,body:v.body.trim()});if(q.error)throw q.error;f.reset();render("Community chat")}),0);
 return panel("General learner discussion",body);
}
async function fees(){
 if(profile.role==="management"){
  const [students,inv,pay]=await Promise.all([
   db().from("profiles").select("id,full_name,email").eq("role","student").eq("is_active",true).order("full_name"),
   db().from("fee_invoices").select("id,title,billing_period,amount,currency,due_date,status,student_id,profiles!fee_invoices_student_id_fkey(full_name,email)").order("due_date",{ascending:false}),
   db().from("fee_payments").select("id,invoice_id,student_id,amount,currency,payment_method,transaction_reference,verification_status,paid_at,profiles!fee_payments_student_id_fkey(full_name,email)").order("created_at",{ascending:false})
  ]);
  for(const x of [students,inv,pay])if(x.error)throw x.error;
  const form='<form class="live-form" id="invoiceForm"><label class="live-field">Student<select name="student_id" required>'+students.data.map(x=>'<option value="'+x.id+'">'+esc(x.full_name||x.email)+'</option>').join("")+'</select></label>'+field("Invoice title","title")+field("Billing period (e.g. November 2026)","billing_period")+'<div class="form-pair">'+field("Amount","amount","number")+'<label class="live-field">Currency<select name="currency"><option value="AFN">AFN</option><option value="USD">USD</option></select></label></div><label class="live-field">Due date<input name="due_date" type="date" required></label><label class="live-field">Description<textarea name="description"></textarea></label><button class="btn btn-green">Create fee invoice</button></form>';
  setTimeout(()=>bind("invoiceForm",async f=>{const v=formData(f);const q=await db().from("fee_invoices").insert({student_id:v.student_id,title:v.title,billing_period:v.billing_period,amount:Number(v.amount),currency:v.currency,due_date:v.due_date,description:v.description||"",created_by:user.id});if(q.error)throw q.error;toast("Invoice created.");render("Fees & payments")}),0);
  const invoices=(inv.data||[]).map(x=>row(x.profiles?.full_name||x.profiles?.email||"Student",x.title+" · "+x.currency+" "+x.amount+" · Due "+x.due_date,nice(x.status))).join("")||empty("No invoices created yet.");
  const pending=(pay.data||[]).filter(x=>x.verification_status==="pending").map(x=>'<article class="live-record"><h4>'+esc(x.profiles?.full_name||x.profiles?.email||"Student")+' · '+esc(x.currency)+' '+esc(x.amount)+'</h4><p>'+esc(nice(x.payment_method))+' · '+esc(x.transaction_reference||"No reference")+'</p><small>Submitted '+esc(date(x.paid_at))+'</small><div class="dash-actions"><button class="btn btn-green" data-verify-payment="'+x.id+'" data-invoice="'+x.invoice_id+'">Verify payment</button><button class="btn btn-outline" data-reject-payment="'+x.id+'">Reject</button></div></article>').join("")||empty("No payments awaiting verification.");
  return form+panel("Fee invoices",invoices)+panel("Payment verification",pending);
 }
 const r=await db().from("fee_invoices").select("id,title,description,billing_period,amount,currency,due_date,status,fee_payments(id,amount,currency,payment_method,transaction_reference,verification_status,paid_at)").eq("student_id",user.id).order("due_date",{ascending:false});
 if(r.error)throw r.error;
 const cards=(r.data||[]).map(x=>{
  const paid=(x.fee_payments||[]).filter(p=>p.verification_status==="verified").reduce((s,p)=>s+Number(p.amount),0);
  const remaining=Math.max(0,Number(x.amount)-paid);
  const dueStatus=x.status==="pending"&&x.due_date<new Date().toISOString().slice(0,10)?"OVERDUE":nice(x.status).toUpperCase();
  const history=(x.fee_payments||[]).map(p=>'<small>'+esc(p.currency)+' '+esc(p.amount)+' · '+esc(nice(p.verification_status))+' · '+esc(date(p.paid_at))+'</small>').join("<br>");
  const form=x.status!=="paid"&&x.status!=="cancelled"?'<form class="live-form feePayForm" data-invoice-id="'+x.id+'"><div class="form-pair">'+field("Amount paid","amount","number")+'<label class="live-field">Payment method<select name="payment_method"><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="mobile_money">Mobile money</option><option value="other">Other</option></select></label></div>'+field("Transaction / receipt reference","transaction_reference")+'<button class="btn btn-green">Submit payment for verification</button></form>':"";
  return '<article class="live-record fee-invoice"><div class="fee-head"><div><h4>'+esc(x.title)+'</h4><small>'+esc(x.billing_period)+' · Due '+esc(x.due_date)+'</small></div><span class="activity-tag">'+esc(dueStatus)+'</span></div><p>'+esc(x.description)+'</p><div class="fee-total"><b>'+esc(x.currency)+' '+esc(x.amount)+'</b><span>Paid: '+esc(paid.toFixed(2))+' · Remaining: '+esc(remaining.toFixed(2))+'</span></div>'+history+form+'</article>';
 }).join("")||empty("No fee invoices have been assigned to your account.");
 setTimeout(()=>document.querySelectorAll(".feePayForm").forEach(f=>f.onsubmit=async e=>{e.preventDefault();const v=formData(f);const invoice=(r.data||[]).find(x=>x.id===f.dataset.invoiceId);const amount=Number(v.amount);const alreadyPaid=(invoice?.fee_payments||[]).filter(p=>p.verification_status==="verified").reduce((s,p)=>s+Number(p.amount),0);const remaining=Math.max(0,Number(invoice?.amount||0)-alreadyPaid);if(!invoice||!Number.isFinite(amount)||amount<=0||amount>remaining)return toast("Enter an amount no greater than the remaining balance.");const q=await db().from("fee_payments").insert({invoice_id:invoice.id,student_id:user.id,amount,currency:invoice.currency,payment_method:v.payment_method,transaction_reference:v.transaction_reference||"",verification_status:"pending"});if(q.error)toast(q.error.message);else{toast("Payment submitted for management verification.");render("Fees & payments")}}),0);
 return panel("My fee account",cards);
}
async function setupNotificationRealtime(){
 if(!db()||!user)return;
 if(notificationChannel){db().removeChannel(notificationChannel);notificationChannel=null}
 const p=await db().from("notification_preferences").select("browser_notifications").eq("user_id",user.id).maybeSingle();
 browserNotificationsEnabled=!!(p.data&&p.data.browser_notifications&&"Notification" in window&&Notification.permission==="granted");
 notificationChannel=db().channel("aurevia-notifications-"+user.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:"recipient_id=eq."+user.id},payload=>{
  if(browserNotificationsEnabled&&"Notification" in window&&Notification.permission==="granted"){
   try{new Notification(payload.new.title,{body:payload.new.body,tag:payload.new.id})}catch(e){}
  }
  if(page==="Notifications")render("Notifications");
 }).subscribe();
}

async function notifications(){
 const [n,p]=await Promise.all([
  db().from("notifications").select("id,title,body,notification_type,action_url,scheduled_for,sent_at,read_at").eq("recipient_id",user.id).order("scheduled_for",{ascending:false}).limit(60),
  db().from("notification_preferences").select("*").eq("user_id",user.id).maybeSingle()
 ]);
 if(n.error)throw n.error;if(p.error)throw p.error;
 const pref=p.data||{daily_homework:true,weekly_lesson:true,monthly_fee:true,browser_notifications:false,email_notifications:false,timezone:"Asia/Kabul",preferred_language:"en"};
 const form='<form class="live-form" id="notificationPrefs"><label class="check-field"><input type="checkbox" name="daily_homework" '+(pref.daily_homework?'checked':'')+'> Daily homework reminders</label><label class="check-field"><input type="checkbox" name="weekly_lesson" '+(pref.weekly_lesson?'checked':'')+'> Weekly lesson reminders</label><label class="check-field"><input type="checkbox" name="monthly_fee" '+(pref.monthly_fee?'checked':'')+'> Monthly fee reminders</label><label class="check-field"><input type="checkbox" name="browser_notifications" '+(pref.browser_notifications?'checked':'')+'> Browser alerts while this site is open (permission required)</label><label class="check-field"><input type="checkbox" name="email_notifications" disabled '+(pref.email_notifications?'checked':'')+'> Email notifications (not connected yet)</label><label class="live-field">Notification language<select name="preferred_language"><option value="en" '+(pref.preferred_language==="en"?"selected":"")+'>English</option><option value="prs" '+(pref.preferred_language==="prs"?"selected":"")+'>دری</option></select></label><label class="live-field">Time zone<input name="timezone" value="'+esc(pref.timezone)+'" required></label><button class="btn btn-green">Save notification settings</button></form>';
 setTimeout(()=>bind("notificationPrefs",async f=>{
  const v=formData(f);
  let browserAllowed=!!v.browser_notifications;
  if(browserAllowed&&"Notification" in window&&Notification.permission==="default")browserAllowed=(await Notification.requestPermission())==="granted";
  if(browserAllowed&&(!("Notification" in window)||Notification.permission!=="granted"))browserAllowed=false;
  const q=await db().from("notification_preferences").upsert({
    user_id:user.id,daily_homework:!!v.daily_homework,weekly_lesson:!!v.weekly_lesson,
    monthly_fee:!!v.monthly_fee,browser_notifications:browserAllowed,email_notifications:false,
    timezone:v.timezone,preferred_language:v.preferred_language||"en"
  });
  if(q.error)throw q.error;
  toast(browserAllowed||!v.browser_notifications?"Notification settings saved.":"Browser permission was not granted; in-app reminders remain active.");
  setupNotificationRealtime();
}),0);
 const list=(n.data||[]).map(x=>'<article class="notification-row '+(x.read_at?'read':'unread')+'"><div><b>'+esc(x.title)+'</b><p>'+esc(x.body)+'</p><small>'+esc(nice(x.notification_type))+' · '+esc(date(x.sent_at||x.scheduled_for))+'</small></div>'+(x.read_at?"":'<button class="activity-tag" data-read-notification="'+x.id+'">Mark read</button>')+'</article>').join("")||empty("You have no notifications yet.");
 return panel("Notification preferences",form)+panel("Your notifications",list);
}

async function records(){
 const [a,b,c]=await Promise.all([db().from("attendance").select("id"),db().from("submissions").select("id"),db().from("enrollments").select("id")]);for(const x of [a,b,c])if(x.error)throw x.error;
 let termForm="",termRows="";
 if(profile.role==="management"){
  const t=await db().from("academic_terms").select("*").order("starts_on",{ascending:false});if(t.error)throw t.error;
  termRows=(t.data||[]).map(x=>row(x.name,date(x.starts_on)+" – "+date(x.ends_on),x.is_current?"CURRENT":"TERM")).join("")||empty("No academic terms have been configured.");
  termForm='<form class="live-form" id="termForm">'+field("Term name","name")+'<label class="live-field">Start date<input type="date" name="starts_on" required></label><label class="live-field">End date<input type="date" name="ends_on" required></label><label class="check-field"><input type="checkbox" name="is_current"> Set as current term</label><button class="btn btn-green">Create academic term</button></form>';
  setTimeout(()=>bind("termForm",async f=>{const v=formData(f);if(v.ends_on<v.starts_on)throw Error("End date must be after the start date.");if(v.is_current){const reset=await db().from("academic_terms").update({is_current:false}).eq("is_current",true);if(reset.error)throw reset.error}const q=await db().from("academic_terms").insert({name:v.name,starts_on:v.starts_on,ends_on:v.ends_on,is_current:!!v.is_current});if(q.error)throw q.error;toast("Academic term created.");render(page)}),0);
 }
 return panel("Academic records summary",'<div class="workspace-stats"><div class="workspace-stat"><div class="stat-top">Attendance entries</div><strong>'+a.data.length+'</strong></div><div class="workspace-stat"><div class="stat-top">Submissions</div><strong>'+b.data.length+'</strong></div><div class="workspace-stat"><div class="stat-top">Enrollments</div><strong>'+c.data.length+'</strong></div></div>')+termForm+panel("Academic terms",termRows);
}
document.addEventListener("click",async e=>{
 const cancelSession=e.target.closest("[data-delete-session]");if(cancelSession){if(!confirm("Cancel and remove this class session?"))return;const q=await db().from("class_sessions").delete().eq("id",cancelSession.dataset.deleteSession);if(q.error)toast(q.error.message);else{toast("Class session cancelled.");render(page)}return}
 const verify=e.target.closest("[data-verify-payment]");if(verify){const id=verify.dataset.verifyPayment,invoiceId=verify.dataset.invoice;const q=await db().from("fee_payments").update({verification_status:"verified",recorded_by:user.id,verified_at:new Date().toISOString()}).eq("id",id);if(q.error)return toast(q.error.message);const [inv,paid]=await Promise.all([db().from("fee_invoices").select("amount").eq("id",invoiceId).single(),db().from("fee_payments").select("amount").eq("invoice_id",invoiceId).eq("verification_status","verified")]);if(inv.error||paid.error)return toast((inv.error||paid.error).message);const sum=paid.data.reduce((s,x)=>s+Number(x.amount),0);const status=sum>=Number(inv.data.amount)?"paid":sum>0?"partial":"pending";const upd=await db().from("fee_invoices").update({status}).eq("id",invoiceId);if(upd.error)return toast(upd.error.message);toast("Payment verified.");render("Fees & payments");return}const reject=e.target.closest("[data-reject-payment]");if(reject){const q=await db().from("fee_payments").update({verification_status:"rejected",recorded_by:user.id,verified_at:new Date().toISOString()}).eq("id",reject.dataset.rejectPayment);if(q.error)toast(q.error.message);else{toast("Payment rejected.");render("Fees & payments")}return}const read=e.target.closest("[data-read-notification]");if(read){const q=await db().from("notifications").update({read_at:new Date().toISOString()}).eq("id",read.dataset.readNotification).eq("recipient_id",user.id);if(q.error)toast(q.error.message);else render("Notifications");return}const subject=e.target.closest("[data-public-subject]");if(subject){showPublicSubject(subject.dataset.publicSubject);return}const file=e.target.closest("[data-download-path]");if(file){const win=window.open("about:blank","_blank");const signed=await db().storage.from("ruya-private").createSignedUrl(file.dataset.downloadPath,60);if(signed.error){if(win)win.close();toast(signed.error.message)}else if(win)win.location.href=signed.data.signedUrl;else toast("Allow pop-ups to open this private file.");return}
 const a=e.target.closest("[data-active-id]");if(a){const q=await db().from("profiles").update({is_active:a.dataset.active!=="true"}).eq("id",a.dataset.activeId);if(q.error)toast(q.error.message);else render(page)}
});
document.addEventListener("change",async e=>{
 const r=e.target.closest("[data-role-id]");if(!r)return;
 r.disabled=true;
 const q=await db().from("profiles").update({role:r.value}).eq("id",r.dataset.roleId);
 if(q.error){toast(q.error.message);render(page)}else{toast("Role updated.");render(page)}
});
async function signOut(){if(communityChannel&&db()){db().removeChannel(communityChannel);communityChannel=null}if(notificationChannel&&db()){db().removeChannel(notificationChannel);notificationChannel=null}if(db())await db().auth.signOut();$("authPassword").value="";user=null;profile=null;$("dashboard").classList.remove("show");$("publicSite").style.display="block";window.scrollTo(0,0)}
window.ruyaNavigate=render;window.ruyaSignIn=signin;window.ruyaSignUp=signupAction;window.ruyaAuthSubmit=()=>authenticate(authSignup);window.ruyaShowLogin=openLogin;window.ruyaOpenLibrary=()=>{const el=$("ged-public-learning");if(el)el.scrollIntoView({behavior:"smooth"});};window.ruyaCloseLogin=close;window.ruyaSignOut=signOut;window.ruyaResetPassword=resetPassword;window.ruyaAuthSwitch=()=>mode($("authSwitch").dataset.mode||"signup");
document.addEventListener("DOMContentLoaded",async()=>{
 loadPublicGedCatalog();
 $("year").textContent=new Date().getFullYear();$("loginModal").addEventListener("click",e=>{if(e.target===$("loginModal"))close()});document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("loginModal").classList.contains("show"))close()});
 const status=$("backendStatus");if(!db()){if(status)status.textContent="Account services are not connected yet. You can explore the public website, but account creation, sign-in and password recovery are temporarily unavailable.";$("authSubmit").disabled=true;$("authSubmit").title="Waiting for AUREVIA account service activation";$("authSwitch").disabled=false;$("forgotPassword").disabled=false;return}else{if(status)status.textContent="Secure account service connected. Use your AUREVIA email and password.";$("authSubmit").disabled=false;$("authSwitch").disabled=false;$("forgotPassword").disabled=false}
 const r=await db().auth.getSession();if(r.data.session){try{await loadProfile(r.data.session.user)}catch(e){await db().auth.signOut();user=null;profile=null;$("dashboard").classList.remove("show");$("publicSite").style.display="block";toast("We could not open your AUREVIA profile. Please sign in again or contact management.")}}
 db().auth.onAuthStateChange((event)=>{if(event==="PASSWORD_RECOVERY"){openLogin("recovery");$("authError").textContent="";}if(event==="SIGNED_OUT"){user=null;profile=null;$("dashboard").classList.remove("show");$("publicSite").style.display="block"}});
});
})();