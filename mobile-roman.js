// WMS SLS v94 — larger stacked QUADRA above ROMAN for mobile + desktop.
(function syncQuadraRomanBrand(){
  const SRC='quadra-roman-logo.svg?v=20260914-2200';
  function stack(width){
    const topW=width, botW=Math.round(width*0.72);
    const wrap=document.createElement('div');
    wrap.className='brand-stack-v94';
    wrap.style.cssText='display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;border-radius:9px;padding:5px 6px;gap:2px;overflow:hidden;flex:0 0 auto;';
    wrap.style.width=(width+12)+'px';
    wrap.innerHTML=`<svg viewBox="0 0 250 110" width="${topW}" height="${Math.round(topW*0.44)}" aria-label="QUADRA"><image href="${SRC}" width="420" height="110"/></svg><svg viewBox="280 0 140 110" width="${botW}" height="${Math.round(botW*0.78)}" aria-label="ROMAN"><image href="${SRC}" width="420" height="110"/></svg>`;
    return wrap;
  }
  function apply(){
    document.querySelectorAll('.mark').forEach(m=>{
      m.innerHTML='';m.style.cssText+=';background:transparent;padding:0;width:auto;height:auto;border-radius:0;overflow:visible;';
      m.appendChild(stack(92));
    });
    document.querySelectorAll('.desk-brand').forEach(b=>{
      b.querySelectorAll('img,.brand-stack-v94').forEach(x=>x.remove());
      b.insertBefore(stack(145),b.firstChild);
    });
    document.querySelectorAll('img.roman-logo,img[src*="roman-logo"],img[alt="ROMAN"],img[alt="Roman"]').forEach(img=>{
      const s=stack(img.closest('.desk-brand')?145:92);img.replaceWith(s);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  [250,700,1500].forEach(ms=>window.setTimeout(apply,ms));
})();

// WMS patch chain. v98 removes size/quota/zoning from operational flow.
(function loadWmsPatches(){
  const eco=document.createElement('script');eco.src='ecosystem_v72.js?v=20260909';eco.defer=false;
  eco.onload=()=>{
    const p81=document.createElement('script');p81.src='wms_permissions_v81.js?v=20260911';p81.defer=false;
    p81.onload=()=>{
      const p82=document.createElement('script');p82.src='wms_spv_opening_v82.js?v=20260912';p82.defer=false;
      p82.onload=()=>{
        const p83=document.createElement('script');p83.src='wms_receiving_autodoc_v83.js?v=20260914c';p83.defer=false;
        p83.onload=()=>{
          const p84=document.createElement('script');p84.src='wms_receiving_access_v84.js?v=20260912';p84.defer=false;
          p84.onload=()=>{
            const p85=document.createElement('script');p85.src='wms_location_detail_v85.js?v=20260912';p85.defer=false;
            p85.onload=()=>{
              const p86=document.createElement('script');p86.src='wms_location_capacity_v86.js?v=20260912';p86.defer=false;
              p86.onload=()=>{
                const p98=document.createElement('script');p98.src='wms_remove_quota_v88.js?v=20260914c';p98.defer=false;
                p98.onload=()=>{
                  const clean=document.createElement('script');clean.src='wms_quota_cleanup_v90.js?v=20260914c';clean.defer=false;
                  clean.onload=()=>{
                    const role=document.createElement('script');role.src='wms_roles_v92.js?v=20260914b';role.defer=false;document.head.appendChild(role);
                  };
                  document.head.appendChild(clean);
                };
                document.head.appendChild(p98);
              };
              document.head.appendChild(p86);
            };
            document.head.appendChild(p85);
          };
          document.head.appendChild(p84);
        };
        document.head.appendChild(p83);
      };
      document.head.appendChild(p82);
    };
    document.head.appendChild(p81);
  };
  document.head.appendChild(eco);
})();
