import { t } from './i18n.js';
import { state } from './state.js';

export function bindUiEvents({
  authStorageKey,
  closeAssetDropdown,
  closeAuthModal,
  loadFavorites,
  normalizeFavorites,
  openAssetDropdown,
  openAuthModal,
  render,
  renderAssetDropdown,
  renderAssetPicker,
  renderAuth,
  renderExchangePicker,
  renderFavoriteTabs,
  saveAuth,
  saveFavorites,
  selectAssetFromSearch,
  setLanguage,
}){
  document.getElementById('langKoButton').addEventListener('click', ()=>setLanguage('ko'));
  document.getElementById('langEnButton').addEventListener('click', ()=>setLanguage('en'));

  const assetSearch=document.getElementById('assetSearch');
  assetSearch.addEventListener('input', e=>{
    renderAssetDropdown(e.target.value);
    openAssetDropdown();
  });
  assetSearch.addEventListener('keydown', e=>{
    if(e.key==='Enter'){
      selectAssetFromSearch(e.target.value);
      closeAssetDropdown();
    }
    if(e.key==='Escape'){
      closeAssetDropdown();
      renderAssetPicker();
    }
  });
  assetSearch.addEventListener('focus', e=>{
    e.target.value='';
    openAssetDropdown();
  });
  assetSearch.addEventListener('click', e=>{
    e.target.value='';
    openAssetDropdown();
  });
  assetSearch.addEventListener('blur', ()=>{
    setTimeout(()=>{
      closeAssetDropdown();
      renderAssetPicker();
    }, 120);
  });

  document.getElementById('sortMode').addEventListener('change', e=>{
    state.sortMode=e.target.value;
    renderAssetPicker();
    renderExchangePicker();
  });
  document.getElementById('favoriteToggle').addEventListener('click', ()=>{
    const favoriteAssetId=state.selectedAsset;
    if(state.favorites.includes(favoriteAssetId)){
      state.favorites=state.favorites.filter(x=>x!==favoriteAssetId);
    } else {
      state.favorites.unshift(favoriteAssetId);
    }
    saveFavorites();
    renderFavoriteTabs();
    render();
  });
  document.getElementById('supportSortFavored').addEventListener('click', ()=>{
    state.supportSortFavored=!state.supportSortFavored;
    render();
  });

  document.getElementById('loginButton').addEventListener('click', ()=>openAuthModal('login'));
  document.getElementById('signupButton').addEventListener('click', ()=>{
    if(state.auth){
      localStorage.removeItem(authStorageKey());
      state.auth=null;
      state.favorites=normalizeFavorites(loadFavorites());
      renderAuth();
      renderFavoriteTabs();
      render();
      return;
    }
    openAuthModal('signup');
  });
  document.getElementById('authGoogleButton').addEventListener('click', ()=>{
    document.getElementById('authStatus').innerHTML=t('googlePending');
  });
  document.getElementById('authCloseButton').addEventListener('click', closeAuthModal);
  document.getElementById('authModal').addEventListener('click', e=>{
    if(e.target.id === 'authModal') closeAuthModal();
  });
  document.getElementById('authSubmitButton').addEventListener('click', ()=>{
    const email=document.getElementById('authEmail').value.trim();
    if(!email || !email.includes('@')){
      document.getElementById('authStatus').textContent=t('invalidEmail');
      return;
    }
    saveAuth(email);
    closeAuthModal();
  });
  document.getElementById('authForm').addEventListener('submit', e=>{
    e.preventDefault();
    document.getElementById('authSubmitButton').click();
  });

}
