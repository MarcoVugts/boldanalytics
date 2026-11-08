const {chromium}=require("playwright"); const fs=require("fs");
(async()=>{const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1080,height:1080}});
 p.on("pageerror",e=>console.log("ERR",e.message));
 await p.goto("file://"+process.cwd()+"/index.html?frames"); await p.waitForTimeout(500);
 fs.rmSync("frames",{recursive:true,force:true}); fs.mkdirSync("frames");
 const FPS=30; let i=0;
 for(;;){ const done=await p.evaluate((ms)=>{window.frame(ms);return window.done;}, i*1000/FPS);
   await p.screenshot({path:`frames/f${String(i).padStart(5,"0")}.png`}); i++;
   if(done){ for(let k=0;k<FPS*2;k++){ fs.copyFileSync(`frames/f${String(i-1).padStart(5,"0")}.png`,`frames/f${String(i).padStart(5,"0")}.png`); i++; } break; }
   if(i>FPS*40) break; }
 console.log("frames",i); await b.close();})();
