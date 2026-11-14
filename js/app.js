(function(){
"use strict";
const $=id=>document.getElementById(id), db=()=>window.ruyaSupabase;
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const nice=s=>String(s||"").replace(/[_-]/g," ").replace(/\b\w/g,c=>c.toUpperCase());
let user=null,profile=null,page="Overview",selectedCourseId=null;
const menus={student:["Overview","Course catalogue","Live classes","Assignments","Attendance","GED library","Community chat","Fees & payments","Notifications","Announcements","Messages"],teacher:["Overview","My GED classes","Teaching schedule","Assignments & grading","Attendance register","GED learning resources","Fees & payments","Community chat","Notifications","Announcements","Messages"],management:["Overview","GED programs","People & roles","Timetables","Academic records","GED library","Community chat","Fees & payments","Notifications","Announcements","Messages"]};
function toast(s){const e=$("toast");e.textContent=s;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),3200)}
let authSignup=false,authReturnFocus=null,recoveryMode=false,pendingPage=null;
function close(){ $("loginModal").classList.remove("show");$("authPassword").value="";$("authError").textContent="";if(authReturnFocus&&typeof authReturnFocus.focus==="function")authReturnFocus.focus(); }
function authErrorMessage(e){const m=String(e&&e.message||"").toLowerCase();if(m.includes("invalid login credentials"))return "The email address or password is incorrect. Check both and try again.";if(m.includes("email not confirmed"))return "Please confirm your email address using the link sent to your inbox.";if(m.includes("user already registered"))return "An account with this email already exists. Please sign in instead.";if(m.includes("password should be at least"))return "For a new account, choose a password with at least 8 characters.";return e&&e.message?e.message:"Authentication failed. Please try again.";}
function mode(m){authSignup=m==="signup";recoveryMode=m==="recovery";$("authNameWrap").hidden=!authSignup;$("authName").required=authSignup;$("authCountryWrap").hidden=!authSignup;$("authCountry").required=authSignup;$("authPassword").autocomplete=authSignup||recoveryMode?"new-password":"current-password";$("authPassword").minLength=authSignup||recoveryMode?8:1;$("authPassword").placeholder=authSignup||recoveryMode?"At least 8 characters":"Your password";$("authModeTitle").textContent=recoveryMode?"Choose a new password":authSignup?"Create your student account":"Welcome back";$("authSubmit").textContent=recoveryMode?"Update password":authSignup?"Create account":"Sign in";$("authSwitch").hidden=recoveryMode;$("forgotPassword").hidden=recoveryMode;const resend=$("resendConfirmation");if(resend)resend.hidden=true;$("authHint").textContent=recoveryMode?"Choose a new password for your AUREVIA account.":"New registrations receive student access only. AUREVIA management assigns teacher and management permissions after verifying staff identity.";$("authSwitch").textContent=authSignup?"Already registered? Sign in":"Create a student account";$("authSwitch").dataset.mode=authSignup?"signin":"signup";$("authSwitch").onclick=()=>mode(authSignup?"signin":"signup");$("authError").textContent="";}
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
  if(signup){const name=$("authName").value.trim();if(!name)throw Error("Enter your full name.");result=await db().auth.signUp({email,password,options:{data:{full_name:name,country:$("authCountry").value.trim()},emailRedirectTo:location.origin+location.pathname}});}
  else result=await db().auth.signInWithPassword({email,password});
  if(result.error)throw result.error;
  if(result.data.session){try{await loadProfile(result.data.user);close()}catch(profileError){await db().auth.signOut();user=null;profile=null;$("dashboard").classList.remove("show");$("publicSite").style.display="block";throw new Error("Your account was authenticated, but its AUREVIA profile could not be opened. Please contact management or try again. "+(profileError.message||""))}}
  else {mode("signin");$("authEmail").value=email;const resend=$("resendConfirmation");if(resend)resend.hidden=false;$("authError").textContent="Your account has been created. Check your inbox (and spam folder) to confirm your email, then return here to sign in."; }
 }catch(e){$("authError").textContent=authErrorMessage(e)}
 finally{$("authSubmit").disabled=false}
}
async function resendConfirmation(){const email=$("authEmail").value.trim();if(!db()){$("authError").textContent="AUREVIA account services are not connected yet.";return}if(!email){$("authError").textContent="Enter your email address first.";$("authEmail").focus();return}const button=$("resendConfirmation");if(button)button.disabled=true;$("authError").textContent="";try{const r=await db().auth.resend({type:"signup",email,options:{emailRedirectTo:location.origin+location.pathname}});if(r.error)throw r.error;$("authError").textContent="Confirmation email sent again. Check your inbox and spam folder."}catch(e){$("authError").textContent="We could not resend the confirmation email: "+(e.message||"Please try again later.")}finally{if(button)button.disabled=false}}
async function resetPassword(){const email=$("authEmail").value.trim();if(!db()){$("authError").textContent="Password recovery is currently unavailable because AUREVIA has not connected its secure account service. Please contact the organisation’s administrator.";return}if(!email){$("authError").textContent="Enter your account email address first."; $("authEmail").focus();return}const redirectTo=location.origin+location.pathname+"?auth=recovery";const r=await db().auth.resetPasswordForEmail(email,{redirectTo});$("authError").textContent=r.error?"We could not send the reset email: "+r.error.message:"If an account exists for this address, password-reset instructions have been sent. Check your inbox and spam folder.";}
async function loadProfile(u){
 const r=await db().from("profiles").select("*").eq("id",u.id).single();if(r.error)throw r.error;
 if(!r.data.is_active){await db().auth.signOut();throw Error("This account is inactive. Contact AUREVIA management.")}
 user=u;profile=r.data;setupNotificationRealtime();$("publicSite").style.display="none";$("dashboard").classList.remove("role-management","role-teacher","role-student");$("dashboard").classList.add("show","role-"+profile.role);
 $("roleLabel").textContent=profile.role==="management"?"ADMINISTRATOR CONSOLE":nice(profile.role)+" portal";const sideCaption=$("workspaceNav")?.previousElementSibling;if(sideCaption)sideCaption.textContent=profile.role==="management"?"ADMINISTRATION CONSOLE":profile.role==="teacher"?"TEACHING WORKSPACE":"YOUR LEARNING SPACE";$("dashUserName").textContent=profile.full_name||u.email;$("dashUserEmail").textContent=u.email;
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
 const allowedPages=menus[profile?.role]||[];if(!allowedPages.includes(p)&&p!=="Course details")p="Overview";
 if(p!=="Community chat"&&communityChannel){db().removeChannel(communityChannel);communityChannel=null;}page=p;nav();$("dashContent").innerHTML=shell(p,"Loading secure institutional records…",'<p class="loading-line">Connecting…</p>');
 try{
  let b="";
  if(p==="Overview")b=await overview();
  else if(["My courses","Course catalogue","GED study plan","Academic programs","GED programs"].includes(p))b=await courses();
   else if(p==="Course details")b=await courseContent();
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
  const a=await db().from("class_sections").select("id,courses!inner(ged_subject_id,is_published)").eq("teacher_id",user.id).not("courses.ged_subject_id","is",null).eq("courses.is_published",true);
  const b=await db().from("assignments").select("id,title").order("created_at",{ascending:false}).limit(6);
  const c=await db().from("submissions").select("id").is("score",null);
  for(const x of [a,b,c])if(x.error)throw x.error;
  stats=[["Assigned classes",a.data.length],["Assignments",b.data.length],["Awaiting grading",c.data.length]];
  activity=b.data.map(x=>row(x.title,"Your assignment","CREATED")).join("");
 }else{
  const a=await db().from("profiles").select("id",{count:"exact",head:true});
  const b=await db().from("courses").select("id",{count:"exact",head:true}).eq("is_published",true).not("ged_subject_id","is",null);
  const c=await db().from("class_sections").select("id,courses!inner(ged_subject_id,is_published)",{count:"exact",head:true}).not("courses.ged_subject_id","is",null).eq("courses.is_published",true);
  const d=await db().from("submissions").select("id",{count:"exact",head:true}).is("score",null);
  for(const x of [a,b,c,d])if(x.error)throw x.error;
  stats=[["Registered users",a.count||0],["Courses",b.count||0],["Class sections",c.count||0],["Ungraded work",d.count||0]];
  activity=row("Institutional records","Counts from the live database","LIVE");
 }
 return '<div class="portal-hero"><small>SECURE AUREVIA WORKSPACE</small><h2>Welcome, '+esc(profile.full_name||"AUREVIA member")+'.</h2><p>Your account is connected. Information shown here is restricted by your role.</p></div><div class="workspace-stats">'+stats.map(x=>'<div class="workspace-stat"><div class="stat-top">'+esc(x[0])+'</div><strong>'+x[1]+'</strong><small>Live database count</small></div>').join("")+'</div>'+panel("Recent activity",activity||empty("No activity yet."));
}
async function courses(){
 if(profile.role==="student"){
  const [catalog,owned,invoices]=await Promise.all([
   db().from("courses").select("id,code,title,title_dari,description,description_dari,level,category,access_type,price_amount,currency,price_afn,price_usd,ged_subject_id").eq("is_published",true).not("ged_subject_id","is",null).order("category").order("title"),
   db().from("enrollments").select("id,course_id,status").eq("student_id",user.id),
   db().from("fee_invoices").select("id,enrollment_id,status").eq("student_id",user.id)
  ]);
  if(catalog.error)throw catalog.error;if(owned.error)throw owned.error;if(invoices.error)throw invoices.error;
  const registrations=new Map((owned.data||[]).map(x=>[x.course_id,x]));
  const invoicesByEnrollment=new Map((invoices.data||[]).filter(x=>x.enrollment_id).map(x=>[x.enrollment_id,x]));
  const cards=(catalog.data||[]).map(c=>{
   const e=registrations.get(c.id),afghanistan=String(profile.country||"").trim().toLowerCase()==="afghanistan",localAmount=afghanistan?c.price_afn:c.price_usd,localCurrency=afghanistan?"AFN":"USD",fee=c.access_type==="free"?"FREE":localAmount!=null?esc(localCurrency)+" "+esc(localAmount):"FEE TO BE ANNOUNCED";
   const invoice=e?invoicesByEnrollment.get(e.id):null;
   const state=e?e.status==="active"?"ENROLLED":e.status==="pending"?(invoice?"INVOICE ISSUED":"WAITING FOR INVOICE"):nice(e.status).toUpperCase():"";
   const action=e?(e.status==="pending"?'<button class="activity-tag" type="button" data-open-fees>VIEW PAYMENT STATUS</button>':'<span class="activity-tag">'+esc(state)+'</span>'):'<button class="btn btn-green" type="button" data-enroll-course="'+c.id+'">'+(c.access_type==="free"?"Enrol free course":"Register for course")+'</button>';
   return '<article class="catalog-card"><div class="catalog-card-top"><span class="activity-tag">'+esc(c.category||"AUREVIA COURSE")+'</span><span class="catalog-price">'+fee+'</span></div><h3><span class="en">'+esc(c.title)+'</span><span class="prs">'+esc(c.title_dari||c.title)+'</span></h3><p><span class="en">'+esc(c.description)+'</span><span class="prs">'+esc(c.description_dari||c.description)+'</span></p><div class="catalog-meta">'+esc(c.code)+' · '+esc(c.level||"All levels")+'</div><div class="catalog-action">'+action+'<button class="activity-tag" type="button" data-course-content="'+c.id+'">COURSE DETAILS</button>'+(e&&e.status==="pending"?'<small>'+(invoice?"Your invoice is ready. Open Fees &amp; payments to review the amount, due date and payment instructions.":"Your registration is recorded. Management has not issued your invoice yet; it will appear under Fees &amp; payments when ready.")+' Live classes unlock after full payment is verified.</small>':"")+'</div></article>';
  }).join("")||empty("Courses are being prepared. Please check again soon.");
  const my=(owned.data||[]).map(e=>{const c=(catalog.data||[]).find(x=>x.id===e.course_id);return c?row(c.title,c.code,nice(e.status)):""}).join("")||empty("You have not registered for a course yet.");
  const countryForm=!profile.country?'<form class="live-form" id="countryForm"><h3>Set your country to apply the correct course fee</h3><label class="live-field">Country of residence<input name="country" required minlength="2" maxlength="80" placeholder="e.g. Afghanistan"></label><button class="btn btn-green">Save country</button></form>':"";
  if(!profile.country)setTimeout(()=>bind("countryForm",async f=>{const v=formData(f);const q=await db().rpc("set_my_country",{_country:v.country.trim()});if(q.error)throw q.error;profile.country=v.country.trim();toast("Country saved. Your regional course fee is now applied.");render("Course catalogue")}),0);
  return countryForm+'<div class="catalog-intro"><h2 class="workspace-page-title">Explore AUREVIA courses</h2><p class="workspace-page-intro">Browse the available programmes and register. Paid courses unlock live classes after management verifies your payment.</p></div><div class="catalog-grid">'+cards+'</div>'+panel("My registrations",my);
 }
 const r=profile.role==="management"?await db().from("courses").select("*").eq("is_published",true).not("ged_subject_id","is",null).order("created_at",{ascending:false}):await db().from("class_sections").select("title,courses!inner(id,title,code,ged_subject_id,is_published)").eq("teacher_id",user.id).not("courses.ged_subject_id","is",null).eq("courses.is_published",true);
 if(r.error)throw r.error;
 let form=profile.role==="management"?'<form class="live-form" id="courseFeeForm"><h3>Set GED course fees and payment details</h3><label class="live-field">GED subject<select name="course_id">'+(r.data||[]).map(x=>'<option value="'+x.id+'">'+esc(x.title)+' · '+(x.price_afn!=null?esc(x.price_afn)+" AFN / "+esc(x.price_usd)+" USD":"Fee not set")+'</option>').join("")+'</select></label>'+field("Course fee amount","price_amount","number")+'<label class="live-field">Currency<select name="currency"><option value="AFN">AFN</option><option value="USD">USD</option></select></label><label class="live-field">Payment instructions<textarea name="payment_instructions" rows="3" placeholder="Payment methods and instructions will be provided here." required>USDT (TRC20): THmcuNkiZfm7ijZ9pbD9vSJopfmrwbGp84\nVisa card: Availability depends on your country and supported payment provider. Message AUREVIA Management if unavailable.\nIn-person payment: Message AUREVIA Management to arrange payment.\nFor USDT, send only on the TRON (TRC20) network. Include your transaction hash when submitting payment. Use this method only where legally permitted.</textarea></label><label class="live-field">Payment due in days<input name="payment_due_days" type="number" min="1" max="30" value="7" required></label><button class="btn btn-green">Save fee and payment details</button></form>':"";
 if(profile.role==="management")setTimeout(()=>bind("courseFeeForm",async f=>{
  const v=formData(f),amount=Number(v.price_amount),days=Number(v.payment_due_days);
  if(!Number.isFinite(amount)||amount<=0)throw Error("Enter a course fee greater than zero.");
  if(!Number.isInteger(days)||days<1||days>30)throw Error("Payment due days must be between 1 and 30.");
  if(!v.payment_instructions.trim())throw Error("Enter clear payment instructions for learners.");
  const course=(r.data||[]).find(x=>x.id===v.course_id);if(!course)throw Error("Select a GED subject.");
  const q=await db().from("courses").update({price_amount:amount,currency:v.currency,payment_instructions:v.payment_instructions.trim(),payment_due_days:days}).eq("id",v.course_id);
  if(q.error)throw q.error;
  const [pending,existing]=await Promise.all([
   db().from("enrollments").select("id,student_id").eq("course_id",v.course_id).eq("status","pending"),
   db().from("fee_invoices").select("enrollment_id").eq("course_id",v.course_id)
  ]);
  if(pending.error)throw pending.error;if(existing.error)throw existing.error;
  const issued=new Set((existing.data||[]).map(x=>x.enrollment_id));
  const due=new Date();due.setHours(12,0,0,0);due.setDate(due.getDate()+days);const dueDate=due.toISOString().slice(0,10);
  let created=0;
  for(const enrolment of pending.data||[]){
   if(issued.has(enrolment.id))continue;
   const invoice=await db().from("fee_invoices").insert({student_id:enrolment.student_id,title:"GED course fee — "+course.title,description:"Course registration fee for "+course.title,billing_period:new Intl.DateTimeFormat("en",{month:"long",year:"numeric"}).format(new Date()),amount,currency:v.currency,due_date:dueDate,status:"pending",course_id:v.course_id,enrollment_id:enrolment.id,payment_instructions:v.payment_instructions.trim(),created_by:user.id});
   if(invoice.error)throw invoice.error;created++;
  }
  toast("Course fee saved. "+created+" pending invoice(s) issued.");render(page);
 }),0);
 const rows=profile.role==="management"?(r.data||[]).map(x=>'<div class="activity-row"><div class="activity-copy"><b>'+esc(x.title)+'</b><small>'+esc(x.code)+' · '+esc(x.category||"")+' · '+esc((x.access_type||"paid").toUpperCase())+'</small></div><button class="activity-tag" type="button" data-course-content="'+x.id+'">MANAGE CONTENT</button></div>').join(""):(r.data||[]).map(x=>'<div class="activity-row"><div class="activity-copy"><b>'+esc(x.courses?.title||x.title)+'</b><small>'+esc(x.courses?.code||"")+'</small></div>'+(x.courses?.id?'<button class="activity-tag" type="button" data-course-content="'+x.courses.id+'">VIEW CONTENT</button>':"")+'</div>').join("");
 return form+panel("Course catalogue",rows||empty("No courses have been added."));
}

async function courseContent(){
 if(!selectedCourseId)return panel("Course details",empty("Choose a course from the catalogue first."));
 const q=await db().from("courses").select("id,code,title,title_dari,description,description_dari,ged_subject_id,access_type,price_amount,currency").eq("id",selectedCourseId).single();
 if(q.error)throw q.error;
 const c=q.data;
 let subject=null,lessons=[],locked=false,courseLessonForm="";
 if(c.ged_subject_id){
  const sr=await db().from("ged_subjects").select("id,code,title_en,title_dari,summary_en,summary_dari,topics,exam_duration_minutes").eq("id",c.ged_subject_id).single();
  if(sr.error)throw sr.error;subject=sr.data;
 }
 if(profile.role==="student"){
  const er=await db().from("enrollments").select("id,status").eq("student_id",user.id).eq("course_id",c.id).maybeSingle();
  if(er.error)throw er.error;
  locked=!er.data||er.data.status!=="active";
 }
 if(subject){
  const r=await db().from("ged_lessons").select("id,title_en,title_dari,summary_en,summary_dari,content_en,content_dari,estimated_minutes,sort_order").eq("subject_id",subject.id).eq("is_published",true).order("sort_order");
  if(r.error)throw r.error;lessons=r.data||[];
 }
 if(!locked){
  const r=await db().from("course_lessons").select("id,title_en,title_dari,summary_en,summary_dari,content_en,content_dari,estimated_minutes,sort_order").eq("course_id",c.id).eq("is_published",true).order("sort_order");
  if(r.error)throw r.error;lessons=lessons.concat(r.data||[]);
 }
 const outcomes={
  MATH:["Solve numerical and algebraic problems using accurate methods.","Interpret graphs, functions, tables and quantitative information.","Apply geometry, measurement, statistics and proportional reasoning to real situations."],
  RLA:["Understand and analyse literary and informational passages.","Identify claims, reasons, evidence, tone and the central idea.","Apply grammar and editing conventions and organise a clear evidence-based written response."],
  SCIENCE:["Read scientific passages, diagrams, tables and data displays.","Understand variables, experimental design and evidence-based conclusions.","Apply life, physical, and Earth and space science reasoning to unfamiliar contexts."],
  SOCIAL:["Analyse historical sources, civic ideas and government information.","Interpret economic and geographic information, maps, tables and graphs.","Compare viewpoints and evaluate claims using evidence and chronological reasoning."]
 };
 const subjectTopics=(subject?.topics||[]).map(t=>'<li>'+esc(t)+'</li>').join("");
 const goals=(outcomes[subject?.code]||[]).map(t=>'<li>'+esc(t)+'</li>').join("");
 const syllabus='<div class="course-detail-grid"><section class="course-detail-card"><small>GED TEST TIME</small><strong>'+esc(subject?.exam_duration_minutes||"—")+' minutes</strong><p>Subject-specific GED test duration.</p></section><section class="course-detail-card"><small>COURSE LEVEL</small><strong>GED preparation</strong><p>Structured preparation for the official GED subject test.</p></section><section class="course-detail-card"><small>LEARNING FORMAT</small><strong>Lessons + practice</strong><p>Guided study, worked examples, reading and interpretation practice, and review.</p></section></div><div class="course-syllabus-grid"><section class="course-detail-card"><h3>What you will study</h3><ul>'+subjectTopics+'</ul></section><section class="course-detail-card"><h3>What you will be able to do</h3><ul>'+goals+'</ul></section></div><section class="course-detail-card"><h3>How learning is organised</h3><ol><li>Study the subject lessons and key concepts.</li><li>Work through examples and topic-based practice.</li><li>Review mistakes and strengthen weaker areas.</li><li>Practise interpreting passages, questions, tables, charts or diagrams relevant to the subject.</li><li>Prepare with time management and test-taking strategies.</li></ol></section>';
 if(profile.role!=="student"){
  courseLessonForm='<form class="live-form" id="courseLessonForm"><h3>Add a course lesson</h3>'+field("Lesson title (English)","title_en")+field("Lesson title (Dari)","title_dari")+'<label class="live-field">Summary (English)<textarea name="summary_en" required></textarea></label><label class="live-field">Summary (Dari)<textarea name="summary_dari" required></textarea></label><label class="live-field">Lesson content (English)<textarea name="content_en" rows="5" required></textarea></label><label class="live-field">Lesson content (Dari)<textarea name="content_dari" rows="5" required></textarea></label><div class="form-pair">'+field("Lesson order","sort_order","number")+field("Estimated minutes","estimated_minutes","number")+'</div><label class="check-field"><input type="checkbox" name="is_published" checked> Publish lesson</label><button class="btn btn-green">Save lesson</button></form>';
  setTimeout(()=>bind("courseLessonForm",async f=>{const v=formData(f);const q=await db().from("course_lessons").insert({course_id:c.id,title_en:v.title_en,title_dari:v.title_dari,summary_en:v.summary_en,summary_dari:v.summary_dari,content_en:v.content_en,content_dari:v.content_dari,sort_order:Number(v.sort_order),estimated_minutes:Number(v.estimated_minutes||20),is_published:!!v.is_published,created_by:user.id});if(q.error)throw q.error;toast("Course lesson saved.");render("Course details")}),0);
 }
 const lessonCards=lessons.map(x=>'<article class="course-lesson"><div class="course-lesson-meta">'+esc(x.estimated_minutes)+' MIN</div><h3><span class="en">'+esc(x.title_en)+'</span><span class="prs">'+esc(x.title_dari)+'</span></h3><p><span class="en">'+esc(x.summary_en)+'</span><span class="prs">'+esc(x.summary_dari)+'</span></p><details><summary>Open lesson</summary><div class="course-lesson-content"><div class="en">'+esc(x.content_en).replace(/\n/g,"<br>")+'</div><div class="prs">'+esc(x.content_dari).replace(/\n/g,"<br>")+'</div></div></details></article>').join("");
 const title='<h2 class="workspace-page-title"><span class="en">'+esc(c.title)+'</span><span class="prs">'+esc(c.title_dari||c.title)+'</span></h2><p class="workspace-page-intro"><span class="en">'+esc(c.description)+'</span><span class="prs">'+esc(c.description_dari||c.description)+'</span></p>';
 const fee=c.price_amount!=null?esc(c.currency)+" "+esc(c.price_amount):"Fee will be confirmed on your course invoice";
 const back='<button class="btn btn-outline" type="button" onclick="ruyaNavigate(\'Course catalogue\')">← Back to course catalogue</button>';
 const access=locked?'<p class="record-note">You can review this complete syllabus before enrolling. Lesson access and live-class links unlock after your course invoice is paid and verified. Open Fees &amp; payments to review any invoice already issued.</p>':"";
 const lessonSection=locked?"":panel("Published course lessons",lessonCards||empty("Course lessons are being prepared."));
 return back+courseLessonForm+panel("Course overview",title+'<div class="course-fee-line"><b>Course fee:</b> '+fee+'</div>'+syllabus+access+lessonSection);
}
async function classes(){
 let sections=[];
 if(profile.role==="student"){const q=await db().from("enrollments").select("class_sections(id,title,starts_at,meeting_url,courses(title))").eq("student_id",user.id).eq("status","active");if(q.error)throw q.error;sections=(q.data||[]).map(x=>x.class_sections).filter(Boolean)}
 else{const q=profile.role==="management"?await db().from("class_sections").select("id,title,starts_at,meeting_url,courses!inner(title,ged_subject_id,is_published)").not("courses.ged_subject_id","is",null).eq("courses.is_published",true):await db().from("class_sections").select("id,title,starts_at,meeting_url,courses!inner(title,ged_subject_id,is_published)").eq("teacher_id",user.id).not("courses.ged_subject_id","is",null).eq("courses.is_published",true);if(q.error)throw q.error;sections=q.data||[]}
 let form="";
 if(profile.role==="management"){const [cs,ts]=await Promise.all([db().from("courses").select("id,title").eq("is_published",true).not("ged_subject_id","is",null).order("title"),db().from("profiles").select("id,full_name,email").eq("role","teacher").eq("is_active",true)]);if(cs.error)throw cs.error;if(ts.error)throw ts.error;form='<form class="live-form" id="sectionForm"><h3>Create a class</h3><label class="live-field">Course<select name="course_id" required>'+cs.data.map(x=>'<option value="'+x.id+'">'+esc(x.title)+'</option>').join("")+'</select></label><label class="live-field">Assigned teacher<select name="teacher_id"><option value="">Unassigned</option>'+ts.data.map(x=>'<option value="'+x.id+'">'+esc(x.full_name||x.email)+'</option>').join("")+'</select></label>'+field("Class / section name","title")+'<label class="live-field">Default meeting link (optional)<input name="meeting_url" type="url" placeholder="https://meet.google.com/..."></label><button class="btn btn-green">Create class</button></form>';setTimeout(()=>bind("sectionForm",async f=>{const v=formData(f);const q=await db().from("class_sections").insert({course_id:v.course_id,teacher_id:v.teacher_id||null,title:v.title,meeting_url:v.meeting_url||null});if(q.error)throw q.error;toast("Class created. Enrol learners before scheduling its sessions.");render(page)}),0)}
 if(profile.role==="teacher"||profile.role==="management"){const opts=sections.map(x=>'<option value="'+x.id+'">'+esc(x.courses?.title||x.title)+' · '+esc(x.title)+'</option>').join("");form+='<form class="live-form" id="sessionForm"><h3>Schedule a live lesson</h3><label class="live-field">Class section<select name="section_id" required>'+opts+'</select></label>'+field("Lesson / session title","title")+'<div class="form-pair"><label class="live-field">Start date and time<input name="starts_at" type="datetime-local" required></label><label class="live-field">End date and time<input name="ends_at" type="datetime-local" required></label></div><label class="live-field">Video platform<select name="video_provider"><option value="google_meet">Google Meet</option><option value="jitsi">Jitsi Meet</option><option value="zoom">Zoom</option><option value="microsoft_teams">Microsoft Teams</option><option value="external">Other video link</option></select></label><label class="live-field">Meeting URL<input name="meeting_url" type="url" placeholder="Paste the meeting link from your video platform" required></label><label class="live-field">Lesson notes / instructions<textarea name="notes" rows="3" placeholder="What students should prepare before joining"></textarea></label><div class="form-pair"><label class="live-field">Slides / lesson materials URL<input name="materials_url" type="url" placeholder="Optional"></label><label class="live-field">Recording URL<input name="recording_url" type="url" placeholder="Add after the lesson"></label></div><label class="live-field">Reminder before class<select name="reminder_minutes_before"><option value="5" selected>5 minutes</option></select></label><label class="check-field"><input type="checkbox" name="is_published" checked> Publish this session to enrolled learners</label><p class="record-note">Times use your device local time. For Google Meet, create the meeting in Meet or Calendar, then paste its link here.</p><button class="btn btn-green">Schedule and publish class</button></form>';setTimeout(()=>bind("sessionForm",async f=>{const v=formData(f),starts=new Date(v.starts_at),ends=new Date(v.ends_at);if(!(ends>starts))throw Error("The class end time must be after its start time.");if(!/^https:\/\//i.test(v.meeting_url))throw Error("Use a secure HTTPS meeting link.");const q=await db().from("class_sessions").insert({section_id:v.section_id,title:v.title,starts_at:starts.toISOString(),ends_at:ends.toISOString(),meeting_url:v.meeting_url,video_provider:v.video_provider,notes:v.notes||"",materials_url:v.materials_url||null,recording_url:v.recording_url||null,reminder_minutes_before:5,is_published:!!v.is_published});if(q.error)throw q.error;toast("Class session scheduled.");render(page)}),0)}
 let query=db().from("class_sessions").select("id,title,starts_at,ends_at,meeting_url,video_provider,notes,materials_url,recording_url,is_published,reminder_minutes_before,class_sections!inner(id,title,courses!inner(title,ged_subject_id,is_published))").not("class_sections.courses.ged_subject_id","is",null).eq("class_sections.courses.is_published",true).order("starts_at",{ascending:true});if(profile.role==="student")query=query.eq("is_published",true);const ses=await query;if(ses.error)throw ses.error;
 const providers={google_meet:"Google Meet",jitsi:"Jitsi Meet",zoom:"Zoom",microsoft_teams:"Microsoft Teams",external:"Online meeting"};
 const list=(ses.data||[]).map(x=>{const upcoming=new Date(x.ends_at)>=new Date();const startMs=new Date(x.starts_at).getTime(),endMs=new Date(x.ends_at).getTime(),nowMs=Date.now(),released=nowMs>=startMs-300000,withinSession=nowMs<=endMs;const join=x.meeting_url?(released&&withinSession?'<button class="btn btn-green" type="button" data-join-session="'+x.id+'" data-meeting-url="'+esc(x.meeting_url)+'">Join live class ↗</button>':released?'<span class="activity-tag">Session ended</span>':'<span class="activity-tag">Meeting link opens '+esc(date(new Date(startMs-300000).toISOString()))+'</span>'):'<span class="activity-tag">Meeting link not added</span>';const links=(x.materials_url?'<a class="activity-tag" href="'+esc(x.materials_url)+'" target="_blank" rel="noopener noreferrer">LESSON MATERIALS ↗</a>':"")+(x.recording_url?'<a class="activity-tag" href="'+esc(x.recording_url)+'" target="_blank" rel="noopener noreferrer">WATCH RECORDING ↗</a>':"");const staff=profile.role!=="student"?'<button class="activity-tag" data-delete-session="'+x.id+'">CANCEL SESSION</button>':"";return '<article class="live-record session-card"><div class="fee-head"><div><span class="activity-tag">'+(upcoming?"UPCOMING":"COMPLETED")+'</span><h4>'+esc(x.title)+'</h4><small>'+esc(x.class_sections?.courses?.title||x.class_sections?.title||"Class")+' · '+esc(providers[x.video_provider]||"Online")+'</small></div><div class="session-time"><b>'+esc(date(x.starts_at))+'</b><small>Ends '+esc(date(x.ends_at))+'</small></div></div>'+(x.notes?'<p>'+esc(x.notes)+'</p>':"")+'<div class="dash-actions">'+(upcoming?join:"")+' '+links+' '+staff+'</div></article>'}).join("");
 const hint=profile.role==="student"?'<p class="record-note">The meeting link appears five minutes before class. Click Join between five minutes before the start and five minutes after the start to be marked Present. After that grace period, a join is recorded as Late. Learners who do not join before the session ends are marked Absent.</p>':'<p class="record-note">Create classes, assign teachers, schedule live lessons and share the meeting link, lesson materials and recordings with enrolled students.</p>';
 return form+panel("Online classroom",hint+(list||empty("No class sessions scheduled yet.")));
}
async function assignments(){
 if(profile.role==="student"){
  const r=await db().from("assignments").select("id,title,instructions,due_at,max_score,submissions(id,status,score,feedback)").eq("is_published",true).order("due_at");if(r.error)throw r.error;
  const content=(r.data||[]).map(a=>'<article class="live-record"><h4>'+esc(a.title)+'</h4><p>'+esc(a.instructions)+'</p><small>Due '+esc(date(a.due_at))+' · Maximum score '+esc(a.max_score)+'</small><form class="live-form submissionForm" data-id="'+a.id+'"><label class="live-field">Your response<textarea name="text_response" required></textarea></label><label class="live-field">Attach a file (optional, up to 25 MB)<input name="attachment" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.mp3,.mp4,.txt"></label><button class="btn btn-green">Submit work</button></form><p class="record-note">'+(a.submissions||[]).map(x=>esc(nice(x.status))+" · Score: "+esc(x.score==null?"Pending":x.score)+" · "+esc(x.feedback||"")).join(" | ")+'</p></article>').join("")||empty("No published assignments.");
  setTimeout(()=>document.querySelectorAll(".submissionForm").forEach(f=>f.onsubmit=async e=>{e.preventDefault();const button=f.querySelector("button");if(button)button.disabled=true;try{const fd=new FormData(f),file=fd.get("attachment");let filePath=null;if(file&&file.size){if(file.size>26214400)throw Error("The attachment must be 25 MB or smaller.");const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");filePath="submissions/"+f.dataset.id+"/"+user.id+"/"+Date.now()+"_"+safe;const up=await db().storage.from("ruya-private").upload(filePath,file,{contentType:file.type||"application/octet-stream",upsert:false});if(up.error)throw up.error}const q=await db().from("submissions").upsert({assignment_id:f.dataset.id,student_id:user.id,text_response:fd.get("text_response"),file_path:filePath,status:"submitted"},{onConflict:"assignment_id,student_id"});if(q.error)throw q.error;toast("Work submitted.");render(page)}catch(x){toast(x.message||"Could not submit work.");if(button)button.disabled=false}}),0);
  return panel("Available assignments",content);
 }
 const s=profile.role==="management"?await db().from("class_sections").select("id,title,courses!inner(title,ged_subject_id,is_published)").not("courses.ged_subject_id","is",null).eq("courses.is_published",true):await db().from("class_sections").select("id,title,courses!inner(title,ged_subject_id,is_published)").eq("teacher_id",user.id).not("courses.ged_subject_id","is",null).eq("courses.is_published",true);if(s.error)throw s.error;
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
 const select=profile.role==="student"
  ?'status,marked_at,joined_at,class_sessions(title,starts_at,ends_at,class_sections(title,courses(title)))'
  :'status,marked_at,joined_at,student_id,class_sessions(title,starts_at,ends_at,class_sections(title,courses(title))),profiles!attendance_student_id_fkey(full_name,email)';
 let query=db().from("attendance").select(select).order("marked_at",{ascending:false}).limit(150);
 if(profile.role==="student")query=query.eq("student_id",user.id);
 const r=await query;if(r.error)throw r.error;
 let form="";
 if(profile.role!=="student"){
  const [ss,ee]=await Promise.all([db().from("class_sessions").select("id,title,section_id,starts_at,class_sections!inner(title,courses!inner(title,ged_subject_id,is_published))").not("class_sections.courses.ged_subject_id","is",null).eq("class_sections.courses.is_published",true).order("starts_at",{ascending:false}),db().from("enrollments").select("section_id,student_id,profiles(full_name,email)").eq("status","active")]);
  if(ss.error)throw ss.error;if(ee.error)throw ee.error;
  const opts=[];
  ss.data.forEach(x=>ee.data.filter(e=>e.section_id===x.section_id).forEach(e=>opts.push('<option value="'+x.id+':'+e.student_id+'">'+esc(e.profiles?.full_name||e.profiles?.email||"Learner")+' · '+esc(x.class_sections?.courses?.title||x.class_sections?.title||"Course")+' · '+esc(x.title)+' · '+esc(date(x.starts_at))+'</option>')));
  form=opts.length?'<form class="live-form" id="attendanceForm"><label class="live-field">Learner and class session<select name="pair">'+opts.join("")+'</select></label><label class="live-field">Attendance status<select name="status"><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="excused">Excused</option></select></label><button class="btn btn-green">Save attendance</button></form>':empty("Create a class session and enrol learners before taking attendance.");
  setTimeout(()=>bind("attendanceForm",async f=>{const v=formData(f),parts=v.pair.split(":");const q=await db().from("attendance").upsert({session_id:parts[0],student_id:parts[1],status:v.status,marked_by:user.id},{onConflict:"session_id,student_id"});if(q.error)throw q.error;toast("Attendance saved.");render(page)}),0);
 }
 const records=(r.data||[]).map(x=>{
  const session=x.class_sessions||{},section=session.class_sections||{};
  const course=section.courses?.title||section.title||"GED course";
  const learner=profile.role==="student"?"":'<b>'+esc(x.profiles?.full_name||x.profiles?.email||"Learner")+'</b> · ';
  return '<article class="attendance-record"><div><small>'+esc(course)+'</small><h4>'+esc(session.title||"Class session")+'</h4><p>'+learner+esc(date(session.starts_at||x.marked_at))+'</p>'+(x.joined_at?'<small>Joined: '+esc(date(x.joined_at))+'</small>':"")+'</div><span class="attendance-status '+esc(x.status)+'">'+esc(nice(x.status))+'</span></article>';
 }).join("");
 const present=(r.data||[]).filter(x=>x.status==="present").length,late=(r.data||[]).filter(x=>x.status==="late").length,absent=(r.data||[]).filter(x=>x.status==="absent").length;
 const stats='<div class="attendance-summary"><div><b>'+present+'</b><small>Present</small></div><div><b>'+late+'</b><small>Late</small></div><div><b>'+absent+'</b><small>Absent</small></div></div>';
 const intro=profile.role==="student"?'<p class="record-note">Your attendance is recorded when you click the class meeting link. Joining from five minutes before the start until five minutes after the start counts as Present. Joining later during the session is marked Late. If you do not join before the session ends, the system records Absent.</p>':"";
 return intro+stats+form+panel(profile.role==="student"?"My course attendance":"Attendance register",records||empty("No attendance records have been recorded yet."));
}
async function library(){
 const r=await db().from("library_resources").select("id,title,description,category,resource_type,storage_path,external_url,visibility,languages,course_id").order("category").order("title");
 if(r.error)throw r.error;
 let form="";
 if(profile.role!=="student"){
  const cr=await db().from("courses").select("id,title").eq("is_published",true).not("ged_subject_id","is",null).order("title");if(cr.error)throw cr.error;
  form='<form class="live-form" id="resourceForm"><h3>Add a learning resource</h3>'+field("Resource title","title")+field("Category / subject","category")+'<label class="live-field">Description<textarea name="description"></textarea></label><label class="live-field">Language<select name="language"><option>English</option><option>Dari</option><option>Pashto</option><option>Arabic</option><option>Multilingual</option></select></label><label class="live-field">Related GED subject (optional)<select name="course_id"><option value="">General library resource</option>'+cr.data.map(x=>'<option value="'+x.id+'">'+esc(x.title)+'</option>').join("")+'</select></label><label class="live-field">External HTTPS URL (optional)<input name="external_url" type="url" placeholder="https://…"></label><label class="live-field">Or upload a file (up to 25 MB)<input name="resource_file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.mp3,.mp4,.txt"></label><label class="live-field">Visibility<select name="visibility"><option value="public">Public — everyone</option><option value="authenticated">All signed-in learners</option><option value="enrolled">Enrolled learners of selected GED subject</option><option value="staff">Staff only</option></select></label><button class="btn btn-green">Publish resource</button></form>';
  setTimeout(()=>bind("resourceForm",async f=>{
   const v=formData(f),file=v.resource_file,external=(v.external_url||"").trim();let path=null;
   if(file&&file.size&&external)throw Error("Choose either an external URL or a file upload, not both.");
   if((!file||!file.size)&&!external)throw Error("Add an external HTTPS URL or upload a file.");
   if(external&&!/^https:\/\//i.test(external))throw Error("Use a secure HTTPS URL.");
   if(v.visibility==="enrolled"&&!v.course_id)throw Error("Choose the GED subject whose enrolled learners may access this resource.");
   if(file&&file.size){if(file.size>26214400)throw Error("The file must be 25 MB or smaller.");const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");path="library/"+user.id+"/"+Date.now()+"_"+safe;const up=await db().storage.from("ruya-private").upload(path,file,{contentType:file.type||"application/octet-stream",upsert:false});if(up.error)throw up.error}
   const languages=v.language==="Multilingual"?["English","Dari","Pashto"]:[v.language||"English"];
   const q=await db().from("library_resources").insert({title:v.title,category:v.category,description:v.description||"",external_url:external||null,storage_path:path,visibility:v.visibility,course_id:v.course_id||null,languages,uploaded_by:user.id,resource_type:path?"file":"link"});
   if(q.error){if(path)await db().storage.from("ruya-private").remove([path]);throw q.error}toast("Resource published to the library.");render(page);
  }),0);
 }
 const categories=[...new Set((r.data||[]).map(x=>x.category).filter(Boolean))].sort();
 const controls='<div class="library-tools"><input id="portalLibrarySearch" type="search" placeholder="Search books by title, author, subject or keyword"><select id="portalLibraryCategory"><option value="">All categories</option>'+categories.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("")+'</select><select id="portalLibraryLanguage"><option value="">All languages</option>'+["English","Dari","Pashto","Arabic"].map(x=>'<option value="'+x+'">'+x+'</option>').join("")+'</select></div><div class="library-book-results" id="portalLibraryBookResults"><p class="empty-state">Search book titles, authors or subjects to discover books in the Open Library catalogue.</p></div><div id="portalLibraryResults" class="library-results"></div>';
 const draw=()=>{
  const q=($("portalLibrarySearch")?.value||"").trim().toLowerCase(),cat=$("portalLibraryCategory")?.value||"",lang=$("portalLibraryLanguage")?.value||"";
  const items=(r.data||[]).filter(x=>(!q||(x.title+" "+x.description+" "+x.category).toLowerCase().includes(q))&&(!cat||x.category===cat)&&(!lang||(x.languages||["English"]).includes(lang)));
  $("portalLibraryResults").innerHTML=items.map(x=>'<article class="library-resource-card"><div class="library-resource-icon">▤</div><div class="library-resource-copy"><b>'+esc(x.title)+'</b><p>'+esc(x.description)+'</p><small>'+esc(x.category)+' · '+esc((x.languages||["English"]).join(" / "))+' · '+esc(nice(x.resource_type))+'</small></div><div class="library-resource-action">'+(x.external_url?'<a class="activity-tag" href="'+esc(x.external_url)+'" target="_blank" rel="noopener noreferrer">OPEN RESOURCE ↗</a>':x.storage_path?'<button class="activity-tag" type="button" data-download-path="'+esc(x.storage_path)+'">OPEN / DOWNLOAD</button>':"")+'</div></article>').join("")||empty("No local resources match these filters. Try the book catalogue above.");
 };
 let bookSearchSequence=0;
 const drawBooks=async()=>{
  const term=($("portalLibrarySearch")?.value||"").trim(),box=$("portalLibraryBookResults"),sequence=++bookSearchSequence;
  if(term.length<2){box.innerHTML='<p class="empty-state">Enter at least two characters to search the Open Library book catalogue.</p>';return}
  box.innerHTML='<p class="loading-line">Searching book titles and authors…</p>';
  try{
   const response=await fetch("https://openlibrary.org/search.json?q="+encodeURIComponent(term)+"&limit=18&fields=key,title,author_name,first_publish_year,edition_count,cover_i,language");
   if(!response.ok)throw Error("The external book catalogue is temporarily unavailable.");
   const data=await response.json();if(sequence!==bookSearchSequence)return;
   const books=(data.docs||[]).filter(x=>/^\/works\/OL\d+W$/.test(x.key||"")).slice(0,18);
   box.innerHTML=books.map(x=>'<article class="library-book-card">'+(x.cover_i?'<img src="https://covers.openlibrary.org/b/id/'+Number(x.cover_i)+'-M.jpg" alt="" loading="lazy">':'<div class="library-book-placeholder">BOOK</div>')+'<div><b>'+esc(x.title||"Untitled book")+'</b><p>'+esc((x.author_name||["Author not listed"]).slice(0,3).join(", "))+'</p><small>'+(x.first_publish_year?esc(x.first_publish_year)+" · ":"")+esc(x.edition_count||1)+' edition(s)</small><div><a class="btn btn-outline" href="https://openlibrary.org'+x.key+'" target="_blank" rel="noopener noreferrer">OPEN BOOK RECORD ↗</a></div></div></article>').join("")||empty("No matching book records were found. Try the author's surname or a shorter title.");
  }catch(error){if(sequence===bookSearchSequence)box.innerHTML='<p class="record-note">'+esc(error.message||"Book search is unavailable right now.")+' You can still use the AUREVIA resources listed below.</p>'}
 };
 setTimeout(()=>{
  ["portalLibrarySearch","portalLibraryCategory","portalLibraryLanguage"].forEach(id=>$(id)?.addEventListener(id==="portalLibrarySearch"?"input":"change",()=>{draw();if(id==="portalLibrarySearch")drawBooks()}));
  draw();drawBooks();
 },0);
 return form+panel("AUREVIA learning library",'<p class="record-note">Search the AUREVIA resources and discover book records by title, author or subject. External book records open in a new tab; availability of full text depends on the publisher or library.</p>'+controls);
}
async function people(){
 const [r,s]=await Promise.all([db().from("profiles").select("id,email,full_name,role,is_active").order("created_at",{ascending:false}),db().from("class_sections").select("id,title,courses!inner(title,ged_subject_id,is_published)").not("courses.ged_subject_id","is",null).eq("courses.is_published",true)]);if(r.error)throw r.error;if(s.error)throw s.error;
 const students=r.data.filter(x=>x.role==="student"&&x.is_active);
 const form='<form class="live-form" id="enrollmentForm"><label class="live-field">Student<select name="student_id">'+students.map(x=>'<option value="'+x.id+'">'+esc(x.full_name||x.email)+'</option>').join("")+'</select></label><label class="live-field">Class section<select name="section_id">'+s.data.map(x=>'<option value="'+x.id+'">'+esc(x.courses?.title||x.title)+' · '+esc(x.title)+'</option>').join("")+'</select></label><button class="btn btn-green">Enroll student</button></form>';
 setTimeout(()=>bind("enrollmentForm",async f=>{const v=formData(f);const q=await db().from("enrollments").insert({student_id:v.student_id,section_id:v.section_id,status:"active"});if(q.error)throw q.error;toast("Student enrolled.");render(page)}),0);
 return form+panel("User directory",(r.data||[]).map(x=>'<div class="activity-row"><div class="activity-copy"><b>'+esc(x.full_name||"New member")+'</b><small>'+esc(x.email)+'</small></div><select class="role-select" data-role-id="'+x.id+'"><option value="student" '+(x.role==="student"?"selected":"")+'>Student</option><option value="teacher" '+(x.role==="teacher"?"selected":"")+'>Teacher</option><option value="management" '+(x.role==="management"?"selected":"")+'>Management</option></select><button class="btn btn-outline" data-active-id="'+x.id+'" data-active="'+x.is_active+'">'+(x.is_active?"Active":"Inactive")+'</button></div>').join("")||empty("No users yet."))+'<p class="record-note">User roles, account status and email are managed by AUREVIA Academy administrators.</p>';
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
 const messages=(r.data||[]).reverse().map(m=>'<article class="chat-message '+(m.sender_id===user.id?'mine':'')+'"><div class="chat-meta"><b>'+esc(m.profiles?.full_name||"AUREVIA management")+'</b><span>'+esc(nice(m.profiles?.role||"management"))+' · '+esc(date(m.created_at))+'</span>'+(profile.role==="management"?'<button class="activity-tag chat-delete" type="button" data-delete-community-message="'+m.id+'">DELETE</button>':"")+'</div><p>'+esc(m.body)+'</p></article>').join("")||empty("No official community messages yet. AUREVIA management will post important updates here.");
 if(!communityChannel){
  communityChannel=db().channel("aurevia-community-general").on("postgres_changes",{event:"*",schema:"public",table:"community_messages",filter:"room_key=eq.general"},()=>{if(page==="Community chat")render("Community chat")}).subscribe();
 }
 const composer=profile.role==="management"?'<form class="chat-compose" id="communityForm"><textarea name="body" maxlength="3000" rows="3" placeholder="Publish an official message to all learners…" required></textarea><button class="btn btn-green" type="submit">Publish message</button></form>':'<p class="record-note">This is an official announcement space. Only AUREVIA management can publish messages; learners can read updates here.</p>';
 const body='<div class="community-chat"><div class="chat-feed" id="communityFeed">'+messages+'</div>'+composer+'<small class="chat-guideline">Official AUREVIA updates only. Do not share passwords or private information.</small></div>';
 if(profile.role==="management")setTimeout(()=>bind("communityForm",async f=>{const v=formData(f),q=await db().from("community_messages").insert({room_key:"general",sender_id:user.id,body:v.body.trim()});if(q.error)throw q.error;f.reset();render("Community chat")}),0);
 return panel("Official community updates",body);
}
async function fees(){
 if(profile.role==="management"){
  const [students,inv,pay,pendingEnrollments,coursesList,waivers]=await Promise.all([
   db().from("profiles").select("id,full_name,email").eq("is_active",true).order("full_name"),
   db().from("fee_invoices").select("id,title,billing_period,amount,currency,due_date,status,student_id,course_id,enrollment_id,payment_instructions,courses(title),profiles!fee_invoices_student_id_fkey(full_name,email)").order("due_date",{ascending:false}),
   db().from("fee_payments").select("id,invoice_id,student_id,amount,currency,payment_method,transaction_reference,receipt_path,verification_status,paid_at,profiles!fee_payments_student_id_fkey(full_name,email)").order("created_at",{ascending:false}),
   db().from("enrollments").select("id,student_id,course_id,profiles(full_name,email),courses(title,price_amount,currency,payment_instructions,ged_subject_id,is_published)").in("status",["pending","active"]).not("courses.ged_subject_id","is",null).eq("courses.is_published",true).order("enrolled_at",{ascending:false}),
   db().from("courses").select("id,title,price_amount,currency").eq("is_published",true).not("ged_subject_id","is",null).order("title"),
   db().from("fee_waivers").select("id,enrollment_id,student_id,course_id,reason,created_at,profiles!fee_waivers_student_id_fkey(full_name,email),courses(title)").order("created_at",{ascending:false})
  ]);
  for(const x of [students,inv,pay,pendingEnrollments,coursesList,waivers])if(x.error)throw x.error;
  const options=(pendingEnrollments.data||[]).map(x=>'<option value="'+x.id+'">'+esc(x.profiles?.full_name||x.profiles?.email||"Student")+' · '+esc(x.courses?.title||"GED course")+'</option>').join("");
  const form='<form class="live-form" id="invoiceForm"><h3>Issue a course invoice or discounted fee</h3><p class="record-note">To give a discount, enter the reduced amount the learner must pay. For example, if the normal fee is 100 and the learner should pay 40, issue an invoice for 40 and explain the discount in the invoice note.</p><label class="live-field">Course registration<select name="enrollment_id" required><option value="">Select a registration</option>'+options+'</select></label><label class="live-field">Student<select name="student_id" required>'+students.data.map(x=>'<option value="'+x.id+'">'+esc(x.full_name||x.email)+'</option>').join("")+'</select></label>'+field("Invoice title","title")+field("Billing period","billing_period")+'<div class="form-pair">'+field("Amount","amount","number")+'<label class="live-field">Currency<select name="currency"><option value="AFN">AFN</option><option value="USD">USD</option></select></label></div><label class="live-field">Due date<input name="due_date" type="date" required></label><label class="live-field">Payment instructions<textarea name="payment_instructions" rows="3" placeholder="Payment methods and instructions will be provided here." required>USDT (TRC20): THmcuNkiZfm7ijZ9pbD9vSJopfmrwbGp84\nVisa card: Availability depends on your country and supported payment provider. Message AUREVIA Management if unavailable.\nIn-person payment: Message AUREVIA Management to arrange payment.\nFor USDT, send only on the TRON (TRC20) network. Include your transaction hash when submitting payment. Use this method only where legally permitted.</textarea></label><label class="live-field">Additional invoice note<textarea name="description"></textarea></label><button class="btn btn-green">Issue invoice to learner</button></form>';
  setTimeout(()=>{
   const sel=$("invoiceForm")?.querySelector('[name="enrollment_id"]');
   if(sel)sel.addEventListener("change",()=>{const en=(pendingEnrollments.data||[]).find(x=>x.id===sel.value);if(!en)return;const student=$("invoiceForm").querySelector('[name="student_id"]');student.value=en.student_id;const amount=$("invoiceForm").querySelector('[name="amount"]');if(en.courses?.price_amount!=null)amount.value=en.courses.price_amount;const currency=$("invoiceForm").querySelector('[name="currency"]');if(en.courses?.currency)currency.value=en.courses.currency;const title=$("invoiceForm").querySelector('[name="title"]');title.value="GED course fee — "+(en.courses?.title||"Course");const instructionsField=$("invoiceForm").querySelector('[name="payment_instructions"]');if(instructionsField)instructionsField.value=en.courses?.payment_instructions||"USDT (TRC20): THmcuNkiZfm7ijZ9pbD9vSJopfmrwbGp84\nVisa card: Availability depends on your country and supported payment provider. Message AUREVIA Management if unavailable.\nIn-person payment: Message AUREVIA Management to arrange payment.\nFor USDT, send only on the TRON (TRC20) network. Include your transaction hash when submitting payment. Use this method only where legally permitted.";});
   bind("invoiceForm",async f=>{
    const v=formData(f),enrollment=(pendingEnrollments.data||[]).find(x=>x.id===v.enrollment_id);
    if(!enrollment)throw Error("Select a pending course registration.");
    const amount=Number(v.amount);if(!Number.isFinite(amount)||amount<=0)throw Error("Enter a valid course fee amount.");
    const q=await db().from("fee_invoices").insert({student_id:enrollment.student_id,title:v.title,billing_period:v.billing_period,amount,currency:v.currency,due_date:v.due_date,description:v.description||"",payment_instructions:v.payment_instructions,course_id:enrollment.course_id,enrollment_id:enrollment.id,created_by:user.id});
    if(q.error)throw q.error;toast("Course invoice and payment instructions issued.");render("Fees & payments");
   });
  },0);
  const invoices=(inv.data||[]).map(x=>row(x.profiles?.full_name||x.profiles?.email||"Student",(x.courses?.title?x.courses.title+" · ":"")+x.title+" · "+x.currency+" "+x.amount+" · Due "+x.due_date,nice(x.status))).join("")||empty("No invoices created yet.");
  const waiverOptions=(pendingEnrollments.data||[]).map(x=>'<option value="'+x.id+'">'+esc(x.profiles?.full_name||x.profiles?.email||"Learner")+' · '+esc(x.courses?.title||"GED subject")+' · '+nice(x.status)+'</option>').join("");
   const scholarshipForm='<form class="live-form" id="managementWaiverForm"><h3>Grant a full scholarship — 100% free</h3><p class="record-note">Choose a learner’s pending or active GED registration. A full waiver records the scholarship, clears pending course invoices and activates course access.</p><label class="live-field">Learner and GED subject<select name="enrollment_id" required><option value="">Choose a registration</option>'+waiverOptions+'</select></label><label class="live-field">Scholarship reason<textarea name="reason" rows="3" minlength="8" maxlength="1000" placeholder="Approved full scholarship based on financial need, merit or another reason." required></textarea></label><button class="btn btn-green" '+(!waiverOptions?'disabled':'')+'>Grant full scholarship</button></form>';
   setTimeout(()=>bind("managementWaiverForm",async f=>{const v=formData(f);const q=await db().rpc("grant_course_fee_waiver",{_enrollment_id:v.enrollment_id,_reason:v.reason.trim()});if(q.error)throw q.error;toast("Full scholarship recorded. Course access is now active.");render("Fees & payments")}),0);
   const waiverHistory=(waivers.data||[]).map(x=>row(x.profiles?.full_name||x.profiles?.email||"Learner",(x.courses?.title||"GED subject")+" · "+x.reason,"FULL SCHOLARSHIP")).join("")||empty("No full scholarships have been granted yet.");
   const pending=(pay.data||[]).filter(x=>x.verification_status==="pending").map(x=>'<article class="live-record"><h4>'+esc(x.profiles?.full_name||x.profiles?.email||"Student")+' · '+esc(x.currency)+' '+esc(x.amount)+'</h4><p>'+esc(nice(x.payment_method))+' · '+esc(x.transaction_reference||"No reference")+'</p>'+(x.receipt_path?'<button class="activity-tag" type="button" data-download-path="'+esc(x.receipt_path)+'">OPEN RECEIPT</button>':"")+'<small>Submitted '+esc(date(x.paid_at))+'</small><div class="dash-actions"><button class="btn btn-green" data-verify-payment="'+x.id+'" data-invoice="'+x.invoice_id+'">Verify payment</button><button class="btn btn-outline" data-reject-payment="'+x.id+'">Reject</button></div></article>').join("")||empty("No payments awaiting verification.");
  const registrations=(pendingEnrollments.data||[]).map(x=>row(x.profiles?.full_name||x.profiles?.email||"Learner",x.courses?.title||"GED course",x.courses?.price_amount!=null?"FEE SET":"SET FEE")).join("")||empty("No pending course registrations.");
  return scholarshipForm+panel("Scholarship history",waiverHistory)+form+panel("Pending course registrations — issue invoices or discounts here",registrations)+panel("Fee invoices",invoices)+panel("Payment verification",pending);
 }
 if(profile.role==="teacher"){
  const [learners,waivers]=await Promise.all([
   db().from("enrollments").select("id,student_id,course_id,status,profiles!fee_waivers_student_id_fkey(full_name,email),courses(title),class_sections!inner(title,teacher_id)").eq("class_sections.teacher_id",user.id).eq("status","pending").order("enrolled_at",{ascending:false}),
   db().from("fee_waivers").select("id,enrollment_id,student_id,course_id,reason,created_at,profiles!fee_waivers_student_id_fkey(full_name,email),courses(title)").eq("teacher_id",user.id).order("created_at",{ascending:false})
  ]);
  if(learners.error)throw learners.error;if(waivers.error)throw waivers.error;
  const options=(learners.data||[]).map(x=>'<option value="'+x.id+'">'+esc(x.profiles?.full_name||x.profiles?.email||"Learner")+' · '+esc(x.courses?.title||"Course")+' · '+esc(x.class_sections?.title||"Class")+'</option>').join("");
  const form='<form class="live-form" id="teacherFeeWaiverForm"><h3>Grant a full course-fee scholarship</h3><p class="record-note">You may waive the full course fee for a learner in one of your assigned classes. The learner will receive course and live-class access immediately. Every waiver is recorded with your name and reason.</p><label class="live-field">Learner and course<select name="enrollment_id" required><option value="">Choose a learner</option>'+options+'</select></label><label class="live-field">Reason for full fee waiver<textarea name="reason" rows="3" minlength="8" maxlength="1000" placeholder="For example: full scholarship based on financial need or academic merit." required></textarea></label><button class="btn btn-green" '+(!(learners.data||[]).length?'disabled':'')+'>Grant full fee waiver</button></form>';
  setTimeout(()=>bind("teacherFeeWaiverForm",async f=>{
   const v=formData(f);if(!v.enrollment_id)throw Error("Choose a learner first.");
   const q=await db().rpc("grant_course_fee_waiver",{_enrollment_id:v.enrollment_id,_reason:v.reason.trim()});
   if(q.error)throw q.error;
   toast("Full fee waiver recorded. The learner now has course and live-class access.");
   render("Fees & payments");
  }),0);
  const pending=(learners.data||[]).map(x=>row(x.profiles?.full_name||x.profiles?.email||"Learner",(x.courses?.title||"Course")+" · "+(x.class_sections?.title||"Assigned class"),"PENDING FEE")).join("")||empty("There are no pending fee registrations in your assigned classes.");
  const history=(waivers.data||[]).map(x=>row(x.profiles?.full_name||x.profiles?.email||"Learner",(x.courses?.title||"Course")+" · "+x.reason,"FULL WAIVER")).join("")||empty("You have not granted any fee waivers yet.");
  return form+panel("Learners awaiting course payment",pending)+panel("Your fee-waiver history",history);
 }
 const [r,er]=await Promise.all([
  db().from("fee_invoices").select("id,title,description,payment_instructions,billing_period,amount,currency,due_date,status,course_id,enrollment_id,courses(title),fee_payments(id,amount,currency,payment_method,transaction_reference,receipt_path,verification_status,paid_at)").eq("student_id",user.id).order("due_date",{ascending:false}),
  db().from("enrollments").select("id,course_id,courses(title,code)").eq("student_id",user.id).eq("status","pending")
 ]);
 if(r.error)throw r.error;if(er.error)throw er.error;
 const cards=(r.data||[]).map(x=>{
  const paid=(x.fee_payments||[]).filter(p=>p.verification_status==="verified").reduce((sum,p)=>sum+Number(p.amount),0),remaining=Math.max(0,Number(x.amount)-paid);
  const dueStatus=x.status==="waived"?"FULL SCHOLARSHIP":x.status==="pending"&&x.due_date<new Date().toISOString().slice(0,10)?"OVERDUE":nice(x.status).toUpperCase();
  const history=(x.fee_payments||[]).map(p=>'<div class="payment-history-item"><small>'+esc(p.currency)+' '+esc(p.amount)+' · '+esc(nice(p.verification_status))+' · '+esc(date(p.paid_at))+'</small>'+(p.receipt_path?'<button class="activity-tag" type="button" data-download-path="'+esc(p.receipt_path)+'">VIEW RECEIPT</button>':"")+'</div>').join("");
  const form=x.status!=="paid"&&x.status!=="cancelled"&&x.status!=="waived"?'<form class="live-form feePayForm" data-invoice-id="'+x.id+'"><div class="form-pair">'+field("Amount paid","amount","number")+'<label class="live-field">Payment method<select name="payment_method"><option value="usdt_trc20">USDT (TRC20)</option><option value="visa_card">Visa card (availability depends on your country)</option><option value="in_person">In-person (message management)</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></label></div>'+field("Transaction / receipt reference","transaction_reference")+'<label class="live-field">Upload payment receipt (optional)<input name="receipt" type="file" accept=".pdf,.jpg,.jpeg,.png"></label><button class="btn btn-green">Submit payment for verification</button></form>':"";
  return '<article class="live-record fee-invoice"><div class="fee-head"><div><h4>'+esc(x.title)+'</h4><small>'+(x.courses?.title?esc(x.courses.title)+" · ":"")+esc(x.billing_period)+' · Due '+esc(x.due_date)+'</small></div><span class="activity-tag">'+esc(dueStatus)+'</span></div><p>'+esc(x.description||"")+'</p><div class="fee-total"><b>'+esc(x.currency)+' '+esc(x.amount)+'</b><span>Paid: '+esc(paid.toFixed(2))+' · Remaining: '+esc(remaining.toFixed(2))+'</span></div><section class="payment-instructions"><b>How to pay</b><p>'+esc(x.payment_instructions||"Please contact AUREVIA management for payment instructions.")+'</p></section>'+history+form+'</article>';
 }).join("")||empty("No fee invoices have been assigned to your account yet.");
 const noInvoice=(er.data||[]).filter(e=>!(r.data||[]).some(i=>i.enrollment_id===e.id));
 const waiting=noInvoice.map(e=>'<article class="pending-invoice-notice"><b>'+esc(e.courses?.title||"GED course")+'</b><span class="activity-tag">WAITING FOR INVOICE</span><p>Your registration has been received. Management has not issued your invoice yet. The amount, due date and payment instructions will appear here as soon as the invoice is issued. You do not need to submit a payment reference until you receive those details.</p></article>').join("");
 setTimeout(()=>document.querySelectorAll(".feePayForm").forEach(f=>f.onsubmit=async e=>{
  e.preventDefault();const v=formData(f),invoice=(r.data||[]).find(x=>x.id===f.dataset.invoiceId),amount=Number(v.amount);
  const alreadyPaid=(invoice?.fee_payments||[]).filter(p=>p.verification_status==="verified").reduce((sum,p)=>sum+Number(p.amount),0),remaining=Math.max(0,Number(invoice?.amount||0)-alreadyPaid);
  if(!invoice||!Number.isFinite(amount)||amount<=0||amount>remaining)return toast("Enter an amount no greater than the remaining balance.");
  const file=v.receipt;let receiptPath=null;
  if(file&&file.size){if(file.size>10485760)return toast("The receipt must be 10 MB or smaller.");const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");receiptPath="payments/"+user.id+"/"+Date.now()+"_"+safe;const up=await db().storage.from("ruya-private").upload(receiptPath,file,{contentType:file.type||"application/octet-stream",upsert:false});if(up.error)return toast(up.error.message);}
  const q=await db().from("fee_payments").insert({invoice_id:invoice.id,student_id:user.id,amount,currency:invoice.currency,payment_method:v.payment_method,transaction_reference:v.transaction_reference||"",receipt_path:receiptPath,verification_status:"pending"});
  if(q.error){if(receiptPath)await db().storage.from("ruya-private").remove([receiptPath]);toast(q.error.message)}else{toast("Payment proof submitted for management verification.");render("Fees & payments")}
 }),0);
 return panel("My fee account",waiting+cards);
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
  if(page==="Notifications")render("Notifications");else if(page==="Live classes")render("Live classes");
 }).subscribe();
}

async function notifications(){
 const [n,p]=await Promise.all([
  db().from("notifications").select("id,title,body,notification_type,action_url,scheduled_for,sent_at,read_at").eq("recipient_id",user.id).order("scheduled_for",{ascending:false}).limit(60),
  db().from("notification_preferences").select("*").eq("user_id",user.id).maybeSingle()
 ]);
 if(n.error)throw n.error;if(p.error)throw p.error;
 const pref=p.data||{daily_homework:true,weekly_lesson:true,monthly_fee:true,class_session_reminders:true,browser_notifications:true,email_notifications:false,timezone:"Asia/Kabul",preferred_language:"en"};
 const form='<form class="live-form" id="notificationPrefs"><label class="check-field"><input type="checkbox" name="daily_homework" '+(pref.daily_homework?'checked':'')+'> Daily homework reminders</label><label class="check-field"><input type="checkbox" name="weekly_lesson" '+(pref.weekly_lesson?'checked':'')+'> Weekly lesson reminders</label><label class="check-field"><input type="checkbox" name="monthly_fee" '+(pref.monthly_fee?'checked':'')+'> Monthly fee reminders</label><label class="check-field"><input type="checkbox" name="class_session_reminders" '+(pref.class_session_reminders?'checked':'')+'> Remind me before each scheduled live class</label><label class="check-field"><input type="checkbox" name="browser_notifications" '+(pref.browser_notifications?'checked':'')+'> Browser alerts while this site is open (permission required)</label><label class="check-field"><input type="checkbox" name="email_notifications" disabled '+(pref.email_notifications?'checked':'')+'> Email notifications (not connected yet)</label><label class="live-field">Notification language<select name="preferred_language"><option value="en" '+(pref.preferred_language==="en"?"selected":"")+'>English</option><option value="prs" '+(pref.preferred_language==="prs"?"selected":"")+'>دری</option></select></label><label class="live-field">Time zone<input name="timezone" value="'+esc(pref.timezone)+'" required></label><button class="btn btn-green">Save notification settings</button></form>';
 setTimeout(()=>bind("notificationPrefs",async f=>{
  const v=formData(f);
  let browserAllowed=!!v.browser_notifications;
  if(browserAllowed&&"Notification" in window&&Notification.permission==="default")browserAllowed=(await Notification.requestPermission())==="granted";
  if(browserAllowed&&(!("Notification" in window)||Notification.permission!=="granted"))browserAllowed=false;
  const q=await db().from("notification_preferences").upsert({
    user_id:user.id,daily_homework:!!v.daily_homework,weekly_lesson:!!v.weekly_lesson,
    monthly_fee:!!v.monthly_fee,class_session_reminders:!!v.class_session_reminders,browser_notifications:browserAllowed,email_notifications:false,
    timezone:v.timezone,preferred_language:v.preferred_language||"en"
  });
  if(q.error)throw q.error;
  toast(browserAllowed||!v.browser_notifications?"Notification settings saved.":"Browser permission was not granted; in-app reminders remain active.");
  setupNotificationRealtime();
}),0);
 const list=(n.data||[]).map(x=>'<article class="notification-row '+(x.read_at?'read':'unread')+'"><div><b>'+esc(x.title)+'</b><p>'+esc(x.body)+'</p><small>'+esc(nice(x.notification_type))+' · '+esc(date(x.sent_at||x.scheduled_for))+'</small>'+(x.action_url?(x.action_url.includes("fees")?'<button class="activity-tag" type="button" data-open-fees>OPEN FEES &amp; PAYMENTS ↗</button>':'<button class="activity-tag" type="button" data-open-live-classes>OPEN LIVE CLASSES ↗</button>'):"")+'</div>'+(x.read_at?"":'<button class="activity-tag" data-read-notification="'+x.id+'">Mark read</button>')+'</article>').join("")||empty("You have no notifications yet.");
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
 const openFees=e.target.closest("[data-open-fees]");if(openFees){render("Fees & payments");return}
 const deleteCommunity=e.target.closest("[data-delete-community-message]");if(deleteCommunity){if(!confirm("Delete this community message permanently?"))return;const q=await db().from("community_messages").delete().eq("id",deleteCommunity.dataset.deleteCommunityMessage);if(q.error)toast(q.error.message);else{toast("Community message deleted.");render("Community chat")}return}
 const joinSession=e.target.closest("[data-join-session]");if(joinSession){const meetingUrl=joinSession.dataset.meetingUrl,tab=window.open("about:blank","_blank");joinSession.disabled=true;const q=await db().rpc("check_in_class_session",{_session_id:joinSession.dataset.joinSession});if(q.error){if(tab)tab.close();toast(q.error.message);joinSession.disabled=false;return}if(tab)tab.location.href=meetingUrl;else window.location.href=meetingUrl;toast("Attendance recorded. Opening your live class…");return}
 const openLive=e.target.closest("[data-open-live-classes]");if(openLive){render("Live classes");return}
 const courseDetails=e.target.closest("[data-course-content]");if(courseDetails){selectedCourseId=courseDetails.dataset.courseContent;render("Course details");return}const courseEnroll=e.target.closest("[data-enroll-course]");if(courseEnroll){courseEnroll.disabled=true;const q=await db().rpc("request_course_enrollment",{_course_id:courseEnroll.dataset.enrollCourse});if(q.error){toast(q.error.message);courseEnroll.disabled=false}else{toast("Registration received. Management will issue your course invoice; live classes unlock after payment is fully verified.");render(page)}return}const cancelSession=e.target.closest("[data-delete-session]");if(cancelSession){if(!confirm("Cancel and remove this class session?"))return;const q=await db().from("class_sessions").delete().eq("id",cancelSession.dataset.deleteSession);if(q.error)toast(q.error.message);else{toast("Class session cancelled.");render(page)}return}
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
window.ruyaNavigate=render;window.ruyaSignIn=signin;window.ruyaSignUp=signupAction;window.ruyaAuthSubmit=()=>authenticate(authSignup);window.ruyaShowLogin=openLogin;window.ruyaOpenLibrary=()=>{const el=$("ged-public-learning");if(el)el.scrollIntoView({behavior:"smooth"});};window.ruyaCloseLogin=close;window.ruyaSignOut=signOut;window.ruyaResetPassword=resetPassword;window.ruyaResendConfirmation=resendConfirmation;window.ruyaAuthSwitch=()=>mode($("authSwitch").dataset.mode||"signup");
document.addEventListener("DOMContentLoaded",async()=>{
 loadPublicGedCatalog();
 $("year").textContent=new Date().getFullYear();$("loginModal").addEventListener("click",e=>{if(e.target===$("loginModal"))close()});document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("loginModal").classList.contains("show"))close()});
 const status=$("backendStatus");if(!db()){if(status)status.textContent="Account services are not connected yet. You can explore the public website, but account creation, sign-in and password recovery are temporarily unavailable.";$("authSubmit").disabled=true;$("authSubmit").title="Waiting for AUREVIA account service activation";$("authSwitch").disabled=false;$("forgotPassword").disabled=false;return}else{if(status)status.textContent="Secure account service connected. Use your AUREVIA email and password.";$("authSubmit").disabled=false;$("authSwitch").disabled=false;$("forgotPassword").disabled=false}
 const r=await db().auth.getSession();if(r.data.session){try{await loadProfile(r.data.session.user)}catch(e){await db().auth.signOut();user=null;profile=null;$("dashboard").classList.remove("show");$("publicSite").style.display="block";toast("We could not open your AUREVIA profile. Please sign in again or contact management.")}}
 db().auth.onAuthStateChange((event)=>{if(event==="PASSWORD_RECOVERY"){openLogin("recovery");$("authError").textContent="";}if(event==="SIGNED_OUT"){user=null;profile=null;$("dashboard").classList.remove("show");$("publicSite").style.display="block"}});
});
})();