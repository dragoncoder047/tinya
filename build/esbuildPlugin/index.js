import{a as e,b as S}from"../chunk-WOW7UPIY.js";import{a as u,n as m,o as r,s as y}from"../chunk-P5FSJCFO.js";import{basename as L}from"node:path";import{readFileSync as b}from"node:fs";var c=new Map,$=0;function A(n){return c.has(n)||c.set(n,"_str"+$+++n.toLowerCase().replaceAll(/[^\w]/g,"")),c.get(n)}u(A,"internString");function V(){return`const ${d([...c].map(([n,t])=>`
${t} = ${m(n)}`).join(", "))};`}u(V,"getInternedStrings");function d(n){return n?n.split(`
`).map(t=>"    "+t).join(`
`):""}u(d,"indent");function i(n,t,...f){return`new AST.${n}(${h(t.loc)}${f.length>0?`,
`:""}${d(f.join(`,
`))})`}u(i,"code");function h(n){return`new LocationTrace(${n.line}, ${n.col}, ${A(n.file)})`}u(h,"location");function P(n){return`[${n.length>0?`
`:""}${d(n.join(`,
`))}]`}u(P,"liststr");function p(n){return P(n.map(o))}u(p,"list");function l(n){return typeof n=="string"?A(n):m(n)}u(l,"prim");function o(n){if(r(n,e.AnnotatedValue))return n.value?i("AnnotatedValue",n,p(n.attributes),o(n.value)):i("AnnotatedValue",n,p(n.attributes));if(r(n,e.Value))return i("Value",n,l(n.value));if(r(n,e.Symbol))return i("Symbol",n,l(n.value));if(r(n,e.Name))return i("Name",n,l(n.name));if(r(n,e.Assignment))return i("Assignment",n,o(n.target),o(n.value));if(r(n,e.Call))return i("Call",n,l(n.name),p(n.args));if(r(n,e.List))return i("List",n,p(n.values));if(r(n,e.Definition))return i("Definition",n,l(n.name),l(n.outMacro),p(n.parameters),o(n.body));if(r(n,e.Template))return i("Template",n,o(n.result));if(r(n,e.InterpolatedValue))return i("InterpolatedValue",n,o(n.value));if(r(n,e.SplatValue))return i("SplatValue",n,o(n.value));if(r(n,e.PipePlaceholder))return i("PipePlaceholder",n);if(r(n,e.BinaryOp))return i("BinaryOp",n,l(n.op),o(n.left),o(n.right),...n.assign?[l(n.noLift),h(n.assign)]:[]);if(r(n,e.UnaryOp))return i("UnaryOp",n,l(n.op),o(n.value));if(r(n,e.Conditional))return i("Conditional",n,o(n.cond),o(n.caseTrue),o(n.caseFalse));if(r(n,e.DefaultPlaceholder))return i("DefaultPlaceholder",n);if(r(n,e.KeywordArgument))return i("KeywordArgument",n,l(n.name),o(n.arg));if(r(n,e.Block))return i("Block",n,p(n.body));if(r(n,e.ParameterDescriptor))return i("ParameterDescriptor",n,l(n.name),o(n.enumOptions),o(n.defaultValue),l(n.lazy));if(r(n,e.Mapping))return i("Mapping",n,P(n.mapping.map(({key:t,val:f})=>`{ key: ${o(t)}, val: ${o(f)} }`)));throw"unreachable"}u(o,"toJS");async function T(n,t){let f=b(n,"utf8"),v={[t]:f};var a;try{a=await S(f,t)}catch(g){if(!r(g,y))throw g;process.stderr.write(g.displayOn(v)),process.exit(1)}$=0,c.clear();let w=o(a);return`import { AST, LocationTrace } from "syd";

export const source = /* @__PURE__ */ ${m(f.split(`
`),null,4)}.join("\\n");

${V()}

export const ast = ${w};

export default ast;
`}u(T,"toJSFile");function F(){return{name:"syd",setup(n){n.onLoad({filter:/\.syd$/},async t=>({contents:await T(t.path,L(t.path)),loader:"js"}))}}}u(F,"sydPlugin");export{F as sydPlugin};
//# sourceMappingURL=index.js.map
