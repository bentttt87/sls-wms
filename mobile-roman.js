// WMS SLS — official QUADRA + ROMAN brand sync for mobile + desktop.
(function syncQuadraRomanBrand(){
  const BRAND_SRC='quadra-roman-logo.svg?v=20260911';
  function apply(){
    // Login + mobile/header marks.
    document.querySelectorAll('.mark').forEach(m=>{
      m.textContent='';
      m.style.background='#fff';
      m.style.padding='3px';
      m.style.width='72px';
      m.style.height='44px';
      m.style.borderRadius='8px';
      const img=document.createElement('img');
      img.src=BRAND_SRC;
      img.alt='QUADRA ROMAN';
      img.style.width='100%';
      img.style.height='100%';
      img.style.objectFit='contain';
      m.appendChild(img);
    });

    // Desktop sidebar brand created by the desktop visual layer.
    document.querySelectorAll('.desk-brand img').forEach(img=>{
      img.src=BRAND_SRC;
      img.alt='QUADRA ROMAN';
      img.style.width='108px';
      img.style.height='62px';
      img.style.objectFit='contain';
      img.style.background='#fff';
      img.style.padding='4px';
    });

    // Any legacy ROMAN image that may be injected by older UI code.
    document.querySelectorAll('img.roman-logo,img[src*="roman-logo"],img[alt="ROMAN"],img[alt="Roman"]').forEach(img=>{
      img.src=BRAND_SRC;
      img.alt='QUADRA ROMAN';
      img.style.objectFit='contain';
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
  window.setTimeout(apply,600);
})();

// WMS patch chain: ecosystem governance -> permission tiers -> SPV opening/location -> auto document detection -> receiving access -> Master Lokasi detail/capacity -> SPV zonasi access.
(function loadWmsPatches(){
  const eco=document.createElement('script');
  eco.src='ecosystem_v72.js?v=20260909';
  eco.defer=false;
  eco.onload=()=>{
    const p81=document.createElement('script');
    p81.src='wms_permissions_v81.js?v=20260911';
    p81.defer=false;
    p81.onload=()=>{
      const p82=document.createElement('script');
      p82.src='wms_spv_opening_v82.js?v=20260912';
      p82.defer=false;
      p82.onload=()=>{
        const p83=document.createElement('script');
        p83.src='wms_receiving_autodoc_v83.js?v=20260912';
        p83.defer=false;
        p83.onload=()=>{
          const p84=document.createElement('script');
          p84.src='wms_receiving_access_v84.js?v=20260912';
          p84.defer=false;
          p84.onload=()=>{
            const p85=document.createElement('script');
            p85.src='wms_location_detail_v85.js?v=20260912';
            p85.defer=false;
            p85.onload=()=>{
              const p86=document.createElement('script');
              p86.src='wms_location_capacity_v86.js?v=20260912';
              p86.defer=false;
              p86.onload=()=>{
                const p87=document.createElement('script');
                p87.src='wms_spv_zone_access_v87.js?v=20260912';
                p87.defer=false;
                document.head.appendChild(p87);
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
