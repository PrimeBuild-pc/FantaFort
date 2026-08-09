import { ImageResponse } from 'next/og';

export const alt = 'FantaFort — Fortnite Fantasy League';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', justifyContent:'center', padding:'80px', color:'white', background:'linear-gradient(120deg,#071426,#244da8 55%,#7b2fc1)' }}>
      <div style={{ color:'#62e7ff', fontSize:28, letterSpacing:8 }}>DROP IN · DRAFT PROS · CLAIM VICTORY</div>
      <div style={{ display:'flex', marginTop:24, fontSize:96, fontWeight:900 }}><span style={{ color:'#f5d300' }}>FANTA</span>FORT</div>
      <div style={{ marginTop:20, fontSize:38 }}>The fantasy league powered by real FNCS results.</div>
      <div style={{ marginTop:48, color:'#c9ddf4', fontSize:24 }}>Independent experience · Not endorsed by Epic Games</div>
    </div>,
    size,
  );
}
