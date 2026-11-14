(function(){
"use strict";
const translations={
"WHO WE ARE":"درباره ما","OUR PURPOSE":"هدف ما","LEARNING":"آموزش","WHAT TO EXPECT":"چه انتظاری داشته باشید","COMMUNITY":"جامعه آموزشی",
"CREATE STUDENT ACCOUNT":"ایجاد حساب شاگرد","PORTAL SIGN IN ↗":"ورود به حساب ↗","YOUR PATHWAY TO GED SUCCESS":"مسیر شما به‌سوی موفقیت در GED",
"PREPARE WITH PURPOSE.":"با هدف آمادگی بگیرید.","BUILD YOUR FUTURE.":"آینده‌تان را بسازید.",
"YOUR PATHWAY TO GED SUCCESS":"مسیر شما به‌سوی موفقیت در GED","AUREVIA GED Academy brings structured GED preparation, expert guidance and meaningful practice together in one bilingual learning platform. Study at your pace, join live classes and track your progress toward your next opportunity.":"آورِویا آمادگی منظم GED، راهنمایی استادان و تمرین‌های هدفمند را در یک پلتفرم دوزبانه گرد هم می‌آورد. با سرعت خود درس بخوانید، در صنف‌های زنده اشتراک کنید و پیشرفت‌تان را دنبال نمایید.",
"EXPLORE GED ↓":"آشنایی با برنامه GED ↓","ENTER LEARNING PORTAL ↗":"ورود به پورتال آموزشی ↗","A place to learn with purpose, develop confidence and turn knowledge into opportunity.":"جایی برای یادگیری هدفمند، افزایش اعتمادبه‌نفس و تبدیل دانش به فرصت.",
"LEARN WITH PURPOSE":"هدفمند بیاموزید","GROW WITH CONFIDENCE":"با اعتمادبه‌نفس رشد کنید","CONTRIBUTE WITH KNOWLEDGE":"با دانش خود سهم بگیرید",
"EDUCATION IS MORE THAN INFORMATION. IT IS THE POWER TO SHAPE A FUTURE.":"آموزش فراتر از معلومات است؛ نیرویی برای ساختن آینده است.",
"Welcome back":"خوش آمدید","Use your AUREVIA account to enter your secure workspace.":"برای ورود به فضای آموزشی امن، از حساب آورِویا استفاده کنید.",
"Full name":"نام مکمل","Email address":"آدرس ایمیل","Password":"رمز عبور","Cancel":"لغو","Sign in":"ورود","Forgot password?":"رمز عبور را فراموش کرده‌اید؟",
"Create a student account":"ایجاد حساب شاگرد","Create student account":"ایجاد حساب شاگرد","Sign out":"خروج","YOUR WORKSPACE":"فضای کاری شما","Keep moving forward.":"به پیشرفت ادامه دهید.","Your next step is always within reach.":"گام بعدی شما همیشه در دسترس است.",
"Overview":"نمای کلی","My courses":"دوره‌های من","GED study plan":"برنامه درسی GED","Live classes":"صنف‌های آنلاین","Class schedule":"تقویم صنف‌ها","Assignments":"کارخانگی‌ها","Attendance":"حاضری","Learning library":"کتابخانه آموزشی","GED library":"کتابخانه GED","Announcements":"اطلاعیه‌ها","Messages":"پیام‌ها","My classes":"صنف‌های من","My GED classes":"صنف‌های GED من","Teaching schedule":"برنامه تدریس","Assignments & grading":"کارخانگی و نمره‌دهی","Attendance register":"ثبت حاضری","Learning resources":"منابع آموزشی","GED learning resources":"منابع آموزشی GED","Academic programs":"برنامه‌های آموزشی","GED programs":"برنامه‌های GED","People & roles":"اشخاص و صلاحیت‌ها","Timetables":"تقویم‌ها","Academic records":"سوابق آموزشی",
"Your response":"پاسخ شما","Submit work":"ارسال کار","Due":"مهلت","Maximum score":"حداکثر نمره","Present":"حاضر","Late":"ناوقت","Absent":"غایب","Excused":"معذور","Save attendance":"ثبت حاضری","Attendance records":"سوابق حاضری","Learning library":"کتابخانه آموزشی","Add resource":"افزودن منبع","Download":"دانلود","Send message":"ارسال پیام","Recipient":"گیرنده","Subject":"موضوع","Message":"پیام","Publish":"نشر","User directory":"فهرست کاربران","Student":"شاگرد","Teacher":"استاد","Management":"مدیریت","Active":"فعال","Inactive":"غیرفعال","Create assignment":"ایجاد کارخانگی","Save grade":"ثبت نمره","No messages.":"پیامی وجود ندارد.","No announcements.":"اطلاعیه‌ای وجود ندارد."
};
let language="en",observer=null,busy=false;
const originals=new WeakMap();
function translateTree(root){
 if(busy)return;busy=true;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 let node;
 while((node=walker.nextNode())){
  if(!originals.has(node))originals.set(node,node.nodeValue);
  const original=originals.get(node);
  const key=original.replace(/\s+/g," ").trim();
  if(!key)continue;
  if(language==="prs"){
   const translated=translations[key.toUpperCase()]||translations[key];
   if(translated!==undefined)node.nodeValue=original.replace(key,translated);
  }else if(node.nodeValue!==original){node.nodeValue=original}
 }
 busy=false;
}
function setLanguage(next){
 language=next==="prs"?"prs":"en";
 document.documentElement.lang=language;
 document.documentElement.dir=language==="prs"?"rtl":"ltr";
 document.body.classList.toggle("dari-mode",language==="prs");
 document.querySelectorAll(".lang-toggle").forEach(b=>b.textContent=language==="prs"?"English":"دری");
 translateTree(document.body);
 try{localStorage.setItem("aurevia-language",language)}catch(e){}
}
window.aureviaToggleLanguage=function(){setLanguage(language==="en"?"prs":"en")};
document.addEventListener("DOMContentLoaded",function(){
 let saved="en";try{saved=localStorage.getItem("aurevia-language")||"en"}catch(e){}
 setLanguage(saved);
 observer=new MutationObserver(records=>{if(language!=="prs")return;for(const r of records){if(r.type==="childList"){r.addedNodes.forEach(n=>{if(n.nodeType===Node.ELEMENT_NODE)translateTree(n);else if(n.nodeType===Node.TEXT_NODE){const p=document.createElement("span");p.appendChild(n.cloneNode());translateTree(p);n.nodeValue=p.textContent}})}else if(r.type==="characterData"){const n=r.target;if(!originals.has(n))originals.set(n,n.nodeValue);translateTree(n.parentNode||document.body)}}});
 observer.observe(document.body,{childList:true,subtree:true,characterData:true});
});
})();