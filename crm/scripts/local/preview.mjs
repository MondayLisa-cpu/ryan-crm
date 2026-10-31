import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
const files=new Map([['/',['index.html','text/html']],['/app.js',['app.js','text/javascript']],['/style.css',['style.css','text/css']]]);
createServer((req,res)=>{
 if(req.headers.host!=='127.0.0.1:3100'&&req.headers.host!=='localhost:3100'){res.writeHead(403).end();return;}
 const file=files.get(req.url);if(req.method!=='GET'||!file){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':`${file[1]}; charset=utf-8`,'Content-Security-Policy':"default-src 'self'; connect-src 'none'; frame-ancestors 'none'",'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 res.end(readFileSync(new URL(`../../preview/${file[0]}`,import.meta.url)));
}).listen(3100,'127.0.0.1',()=>console.log('本機示範已啟動，請在電腦瀏覽器輸入 http://127.0.0.1:3100 。Ctrl+C 停止。'));
