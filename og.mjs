import './mute-auto.mjs'
// og.png（1200x630）を作る。node og.mjs
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname, PORT = 5475
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(MUTE_LAUNCH), ctx = await b.newContext({ viewport: { width: 1200, height: 630 } }); await muteContext(ctx)
const p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/privacy.html`)
await p.setContent(`<!doctype html><html><head><base href="http://localhost:${PORT}/"><link href="https://fonts.googleapis.com/css2?family=RocknRoll+One&family=Yusei+Magic&display=swap" rel="stylesheet"><style>
*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;overflow:hidden;background:#c9a77a url(img/room.webp) center 40%/cover;font-family:"Yusei Magic",sans-serif;position:relative}
body::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(29,20,14,.15),rgba(29,20,14,.25) 50%,rgba(29,20,14,.78))}
.c{position:absolute;width:250px;height:375px;border:8px solid #fff;box-shadow:0 14px 30px rgba(0,0,0,.45);background:#fff}
.c img{width:100%;height:100%;object-fit:cover;display:block}
.c b{position:absolute;left:50%;bottom:-22px;transform:translateX(-50%) rotate(-3deg);background:#d23a2a;color:#fff;font-family:"RocknRoll One";font-weight:400;font-size:24px;padding:4px 14px;white-space:nowrap}
.c i{position:absolute;left:-8px;top:-34px;font-style:normal;background:#f3d36b;padding:3px 10px;font-size:21px;transform:rotate(-4deg);white-space:nowrap;color:#2a1d14}
.t{position:absolute;right:46px;top:90px;width:400px;text-align:center;color:#fff3dc}
.t h1{font-family:"RocknRoll One";font-weight:400;font-size:76px;line-height:1.1;text-shadow:0 4px 14px #000}
.t h1 em{font-style:normal;color:#ff6a50}
.t p{font-size:30px;margin-top:16px;text-shadow:0 2px 8px #000}
.t small{display:block;margin-top:26px;font-size:24px;color:#f3d36b;text-shadow:0 2px 6px #000}
</style></head><body>
<div class="c" style="left:40px;top:150px;transform:rotate(-6deg)"><i>勉強だけ</i><img src="img/p_otaku.webp"><b>本の虫</b></div>
<div class="c" style="left:250px;top:110px;transform:rotate(2deg);z-index:2"><i>30日寝た</i><img src="img/p_pillow.webp"><b>抱き枕</b></div>
<div class="c" style="left:470px;top:160px;transform:rotate(7deg)"><i>全部磨いた</i><img src="img/p_takane.webp"><b>高嶺の花</b></div>
<div class="t"><h1>自分磨き<br><em>30</em>日</h1><p>恋人は、磨いた分だけ</p><small>筋トレ・勉強・美容院・寝る<br>来る恋人は全17人</small></div>
</body></html>`)
await p.waitForLoadState('networkidle'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300)
await p.screenshot({ path: ROOT + '/og.png' })
await b.close(); server.kill()
