# Verify Snippets

Copy-paste `execute` snippets that audit a design on the canvas, before a line of code exists.

**Every snippet here was run against a real four-screen document.** Where one produced a wrong answer, the wrong answer and its fix are written down, because the same trap will catch the next person.

Paste a whole block. They define their helpers as globals (no `const`), so later `execute` calls in the same session can reuse them.

---

## 1. Layout: overflow, collapse, invisible text

`ctx.problems` cannot be trusted (see `failure-modes.md` §1), so this does the arithmetic instead.

```js
pad4=(p)=>{ if(p==null)return[0,0,0,0]; if(typeof p==="number")return[p,p,p,p]
  const a=p.map(v=>typeof v==="number"?v:0)
  if(a.length===1)return[a[0],a[0],a[0],a[0]]
  if(a.length===2)return[a[0],a[1],a[0],a[1]]
  if(a.length===3)return[a[0],a[1],a[2],a[1]]
  return a }

layoutAudit=(root,label)=>{
  let over=0,zero=0,nofill=0
  Get(root,(n,c)=>{
    if(n.enabled===false){c.skipChildren();return}
    if(c.bounds.width<1||c.bounds.height<1){zero++;Print("   collapsed:",n.name,n.type)}
    if(n.type==="text"&&!n.fill){nofill++;Print("   invisible (no fill):",n.name,JSON.stringify((n.content||"").slice(0,30)))}
    const p=c.parentCtx
    if(p&&p.node.justifyContent!=="space_between"){
      const pv=pad4(p.node.padding)
      const limitR=p.bounds.width-pv[1]
      const r=c.bounds.x+c.bounds.width
      if(r-limitR>1.5){over++;Print("   overflows:",n.name,"in",p.node.name,Math.round(r),">",Math.round(limitR))}
    }
  })
  Print("  ",label,"→",over+" overflow, "+zero+" collapsed, "+nofill+" invisible")
}
layoutAudit("SCREEN_ID","Home V1")
```

**Reading the output.** In a flex row, one oversized child pushes every sibling after it out of the frame too, so a single mistake reports as several overflows. **The first flagged item in a row is the cause; the rest are consequences.** Fix the first and re-run before touching anything else.

`space_between` parents are skipped deliberately: their children's bounds are unreliable, so any result would be noise.

---

## 2. Token compliance

The highest-value audit on the canvas. It catches the design system decaying while you work, which otherwise surfaces months later as a hex code nobody can trace.

```js
tokenAudit=(root,label)=>{
  const isVar=v=>typeof v==="string"&&v.startsWith("$")
  let n=0
  Get(root,(node,c)=>{
    if(node.enabled===false){c.skipChildren();return}
    const fs=Array.isArray(node.fill)?node.fill:[node.fill]
    for(const f of fs){
      if(typeof f==="string"&&!isVar(f)){n++;Print("   fill  ",node.name,f)}
      else if(f&&f.type==="color"&&!isVar(f.color)){n++;Print("   fill  ",node.name,f.color)}
    }
    if(typeof node.stroke==="string"&&!isVar(node.stroke)){n++;Print("   stroke",node.name,node.stroke)}
    if(node.type==="text"&&typeof node.fontSize==="number"){n++;Print("   size  ",node.name,node.fontSize)}
  })
  Print("  ",label,"→",n?n+" literal(s) that should be tokens":"clean")
}
tokenAudit("SCREEN_ID","Home V1")
```

Run it **without** `resolveVariables`, or everything resolves to a literal and every node looks like a violation.

Expect a small number of deliberate exceptions — a logo lockup sized off its mark rather than off the type scale, a scrim alpha. Document each one in `DESIGN-GUIDELINES.md` rather than letting the count drift upward unexplained.

---

## 3. Contrast, measured on the canvas

Measures the real ink/ground pair for every text node, before the build exists. This is how a design ships already knowing it will pass an accessibility audit.

```js
hexOf=(v)=>{ if(typeof v!=="string"||v[0]!=="#")return null
  let h=v.slice(1); if(h.length===3)h=h.split("").map(c=>c+c).join("")
  return h.length>=6?h.slice(0,6).toLowerCase():null }
lum=(h)=>{const f=i=>{let c=parseInt(h.substr(i,2),16)/255
  return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)}
  return .2126*f(0)+.7152*f(2)+.0722*f(4)}
cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}

contrastAudit=(root,label)=>{
  const pairs={}; let overMedia=0
  Get(root,(n,c)=>{
    if(n.enabled===false){c.skipChildren();return}           // guard 1: hidden subtree
    if(n.type!=="text"||!n.content) return
    const fg=hexOf(n.fill); if(!fg) return
    let p=c.parentCtx,bg=null,media=false
    while(p&&!bg&&!media){
      if(p.node.enabled===false){media=true;break}
      const fs=Array.isArray(p.node.fill)?p.node.fill:[p.node.fill]
      for(const f of fs){
        if(f&&(f.type==="image"||f.type==="gradient")){media=true;break}   // guard 2
        const h=hexOf(typeof f==="string"?f:(f&&f.color)); if(h){bg=h;break} }
      p=p.parentCtx }
    if(media){overMedia+=n.content.length;return}
    if(!bg) return
    const size=n.fontSize||16, wt=String(n.fontWeight||"400")
    const large=size>=24||(size>=18.66&&(wt==="bold"||parseInt(wt)>=700))
    const k=fg+"|"+bg+"|"+(large?"L":"B")
    pairs[k]=(pairs[k]||0)+n.content.length
  },{resolveVariables:true,resolveInstances:true})                          // guard 3
  let bad=0
  Object.entries(pairs).sort((a,b)=>b[1]-a[1]).forEach(([k,ch])=>{
    const [fg,bg,kind]=k.split("|"),r=cr(fg,bg),need=kind==="L"?3:4.5
    if(r<need){bad++;Print("   FAIL  #"+fg,"on #"+bg,r.toFixed(2)+":1",kind==="L"?"large":"body",ch+" chars")}
  })
  Print("  ",label,"→",bad?bad+" FAILING":"all solid-ground pairs pass",
        "| over media:",overMedia,"chars")
}
contrastAudit("SCREEN_ID","Home V1")
```

### The three guards, and why each exists

Each was added after the snippet produced a confident wrong answer on a real document.

1. **`resolveVariables` and `resolveInstances`.** Without them every fill is `"$ink"` and every instanced component is opaque, so the audit silently covers almost nothing.
2. **Stop at an image or gradient fill.** A heading on a full-bleed photograph has no measurable ground. Without this guard the walker skips straight past the photo to a distant page background and reported *white on chalk, 1.14:1, FAIL* for a headline that was sitting correctly on a dark scrimmed image. **Text over media is reported as a count and measured on the render instead** — the design skill's scrim rules cover it.
3. **Skip `enabled: false`.** A descendant disabled on an instance keeps the component's default content and fill in a resolved read. Without this guard it reported *`#a8a49b` on `#f2f0eb`, 2.18:1, FAIL* for two strikethrough prices that are not rendered at all.

With all three, the same four screens came back clean, matching the measured table in their `DESIGN-GUIDELINES.md` to two decimal places.

**It cannot check text over photography.** That is the one case that needs a render: screenshot the section and measure at the brightest frame under the copy.

---

## 4. Component reuse census

A design where the footer is copy-pasted seven times ships as seven slightly different footers. This counts what is actually instanced.

```js
reuseCensus=(screenIds)=>{
  const comps={}, refs={}
  Get(n=>{ if(n.reusable) comps[n.id]=n.name })
  for(const s of screenIds) Get(s,n=>{ if(n.type==="ref") refs[n.ref]=(refs[n.ref]||0)+1 })
  Object.entries(comps).forEach(([id,name])=>
    Print("  ",name.padEnd(22),(refs[id]||0)+" instance(s)", refs[id]?"":"  ← unused"))
  const total=Object.values(refs).reduce((a,b)=>a+b,0)
  Print("  ",Object.keys(comps).length+" components,",total,"instances")
}
reuseCensus(["SCREEN_1","SCREEN_2","SCREEN_3"])
```

A component with 0 instances is either dead or about to be copy-pasted. A screen with almost no `ref` nodes is a screen built by copy-paste.

---

## 5. Shape and effect policy

Catches the system drifting: three radii where the guidelines name two, shadows on a page that said it had none.

```js
policyAudit=(screenIds)=>{
  const rad={},sh={},bor={},grad=[]
  for(const s of screenIds) Get(s,(n,c)=>{
    if(n.enabled===false){c.skipChildren();return}
    if(n.cornerRadius!==undefined){const k=n.cornerRadius>500?"pill":String(n.cornerRadius);rad[k]=(rad[k]||0)+1}
    if(n.effect) sh[JSON.stringify(n.effect).slice(0,50)]=(sh[JSON.stringify(n.effect).slice(0,50)]||0)+1
    const bw=n.strokeWidth; if(typeof bw==="number"&&bw>0) bor[bw]=(bor[bw]||0)+1
    const fs=Array.isArray(n.fill)?n.fill:[n.fill]
    for(const f of fs) if(f&&f.type==="gradient") grad.push(n.name)
  })
  Print("   radii   ",JSON.stringify(rad))
  Print("   borders ",JSON.stringify(bor))
  Print("   shadows ",Object.keys(sh).length?JSON.stringify(sh):"none")
  Print("   gradients",grad.length?grad.join(", "):"none")
}
policyAudit(["SCREEN_1","SCREEN_2"])
```

Read it against `DESIGN-GUIDELINES.md` §6. Radii of `{2, pill}` is a policy. `{2, 4, 6, 8, 12, pill}` is an accident.

---

## 6. Document hygiene

```js
Get("document",(n,c)=>{
  if(c.depth!==1) return
  c.skipChildren()
  if(!["frame","group"].includes(n.type)) Print("   loose at root:",n.id,n.name,n.type)
})
```

Only screen frames, reusable components and major containers belong at the root. A loose text node or rectangle there is a leftover and will confuse the next person reading the document.

---

## 7. The whole pass

```js
for(const [id,label] of [["SCREEN_1","Home"],["SCREEN_2","About"]]) {
  Print("══",label,"══")
  layoutAudit(id,label); tokenAudit(id,label); contrastAudit(id,label)
}
policyAudit(["SCREEN_1","SCREEN_2"])
reuseCensus(["SCREEN_1","SCREEN_2"])
```

Run it when a screen is finished, and again before handoff. Then screenshot the finished sections, because none of this can tell you whether the thing is any good — that is `design/references/award-bar.md`.
