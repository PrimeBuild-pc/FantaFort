"use client";

import { PointerEvent, useMemo, useState } from 'react';

export type ChartRange = '1D' | '1W' | '1M' | 'ALL';
export type TradingPoint = { at: string; price: number };

type Props = {
  points: TradingPoint[];
  range: ChartRange;
  onRangeChange: (range: ChartRange) => void;
  locale: string;
  loading?: boolean;
};

const WIDTH = 800, HEIGHT = 300, LEFT = 58, RIGHT = 16, TOP = 18, BOTTOM = 34;

export default function TradingChart({ points, range, onRangeChange, locale, loading }: Props) {
  const [mode, setMode] = useState<'area'|'line'>('area');
  const [hovered, setHovered] = useState<number>();
  const chart = useMemo(() => {
    const rows = [...points].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    const prices = rows.map(point=>point.price);
    const rawMin = prices.length ? Math.min(...prices) : 0, rawMax = prices.length ? Math.max(...prices) : 1;
    const padding = Math.max(25, (rawMax-rawMin)*.12);
    const min = Math.max(0, rawMin-padding), max = rawMax+padding;
    const start = Date.parse(rows[0]?.at || new Date(0).toISOString());
    const end = Math.max(start+1, Date.parse(rows.at(-1)?.at || new Date(1).toISOString()));
    const xy = rows.map(point=>({
      ...point,
      x:rows.length===1?WIDTH-RIGHT:LEFT+(Date.parse(point.at)-start)/(end-start)*(WIDTH-LEFT-RIGHT),
      y:TOP+(max-point.price)/(max-min)*(HEIGHT-TOP-BOTTOM),
    }));
    const line = xy.length===1?`${LEFT},${xy[0].y} ${WIDTH-RIGHT},${xy[0].y}`:xy.map(point=>`${point.x},${point.y}`).join(' ');
    const area = `${LEFT},${HEIGHT-BOTTOM} ${line} ${WIDTH-RIGHT},${HEIGHT-BOTTOM}`;
    return {rows:xy,min,max,start,end,line,area};
  },[points]);
  const first = chart.rows[0]?.price || 0, current = chart.rows.at(-1)?.price || 0;
  const change = current-first, percent = first ? change/first*100 : 0;
  const high = chart.rows.length ? Math.max(...chart.rows.map(point=>point.price)) : 0, low = chart.rows.length ? Math.min(...chart.rows.map(point=>point.price)) : 0;
  const number = (value:number)=>new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(value);
  const date = (value:number)=>new Intl.DateTimeFormat(locale,range==='1D'?{hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'short',year:range==='ALL'?'2-digit':undefined}).format(value);
  const move = (event:PointerEvent<SVGSVGElement>) => {
    if(!chart.rows.length)return;
    const box=event.currentTarget.getBoundingClientRect();
    const x=(event.clientX-box.left)/box.width*WIDTH;
    let nearest=0;
    chart.rows.forEach((point,index)=>{if(Math.abs(point.x-x)<Math.abs(chart.rows[nearest].x-x))nearest=index;});
    setHovered(nearest);
  };
  const active = hovered == null ? chart.rows.at(-1) : chart.rows[hovered];
  const ticks=[0,.25,.5,.75,1];

  return <section className="advanced-chart">
    <header><div><small>PLAYER PRICE</small><strong>{number(active?.price||0)} C</strong><span className={change>=0?'positive':'negative'}>{change>=0?'+':''}{number(change)} · {percent>=0?'+':''}{percent.toFixed(2)}%</span></div><div className="chart-controls"><div>{(['1D','1W','1M','ALL'] as ChartRange[]).map(value=><button className={range===value?'active':''} onClick={()=>onRangeChange(value)} key={value}>{value}</button>)}</div><div><button className={mode==='area'?'active':''} onClick={()=>setMode('area')}>AREA</button><button className={mode==='line'?'active':''} onClick={()=>setMode('line')}>LINE</button></div></div></header>
    <div className="chart-summary"><span>OPEN <b>{number(first)} C</b></span><span>HIGH <b>{number(high)} C</b></span><span>LOW <b>{number(low)} C</b></span><span>LAST <b>{number(current)} C</b></span></div>
    <div className="chart-canvas">{loading?<div className="chart-loading">Loading price history…</div>:<svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" onPointerMove={move} onPointerLeave={()=>setHovered(undefined)} role="img" aria-label="Player price history">
      <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#62e7ff" stopOpacity=".38"/><stop offset="1" stopColor="#62e7ff" stopOpacity="0"/></linearGradient></defs>
      {ticks.map(tick=>{const y=TOP+tick*(HEIGHT-TOP-BOTTOM);const value=chart.max-tick*(chart.max-chart.min);return <g key={tick}><line className="chart-gridline" x1={LEFT} x2={WIDTH-RIGHT} y1={y} y2={y}/><text className="chart-axis" x={LEFT-8} y={y+4} textAnchor="end">{number(value)}</text></g>})}
      {mode==='area'&&<polygon className="chart-area" points={chart.area}/>}<polyline className="chart-line" points={chart.line}/>
      {[chart.start,(chart.start+chart.end)/2,chart.end].map((value,index)=><text className="chart-axis" key={index} x={[LEFT,(LEFT+WIDTH-RIGHT)/2,WIDTH-RIGHT][index]} y={HEIGHT-8} textAnchor={(['start','middle','end'] as const)[index]}>{date(value)}</text>)}
      {active&&<g><line className="chart-crosshair" x1={active.x} x2={active.x} y1={TOP} y2={HEIGHT-BOTTOM}/><circle className="chart-dot" cx={active.x} cy={active.y} r="5"/></g>}
    </svg>}{active&&hovered!=null&&<div className="chart-tooltip" style={{left:`${active.x/WIDTH*100}%`,top:`${active.y/HEIGHT*100}%`}}><b>{number(active.price)} C</b><span>{new Date(active.at).toLocaleString(locale)}</span></div>}</div>
    <p className="chart-caption">Prices change only when competitive form changes. Flat sections are real unchanged values; no synthetic volume or candles.</p>
  </section>;
}
