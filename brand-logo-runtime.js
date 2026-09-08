(()=>{
  const DARK_ASSET='/brand-logo-theme-dark.png';
  const LIGHT_ASSET='/brand-logo-theme-light.png';
  const desiredAsset=()=>document.documentElement.getAttribute('data-theme')==='light'?LIGHT_ASSET:DARK_ASSET;
  const dashboardButton=()=>[...document.querySelectorAll('.nav button')].find(button=>button.textContent.trim().includes('Dashboard'));
  const install=()=>{
    const host=document.querySelector('.brand');
    if(!host)return;
    host.classList.add('tr-brand-host');
    let button=host.querySelector('.tr-brand-home');
    let image=host.querySelector('.tr-brand-logo');
    if(!button||!image){
      button=document.createElement('button');
      button.type='button';
      button.className='tr-brand-home';
      button.setAttribute('aria-label','Ir al Dashboard');
      image=document.createElement('img');
      image.className='tr-brand-logo';
      image.alt='Trading Research';
      button.appendChild(image);
      button.addEventListener('click',()=>dashboardButton()?.click());
      host.replaceChildren(button);
    }
    const asset=desiredAsset();
    if(image.getAttribute('src')!==asset)image.setAttribute('src',asset);
  };
  const app=document.getElementById('app');
  if(app)new MutationObserver(install).observe(app,{childList:true,subtree:true});
  new MutationObserver(install).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  install();
})();
