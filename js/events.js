import { t } from './i18n.js';
import { state } from './state.js';
import { authClient, signInWithGoogle } from './auth.js?v=1';

export function bindUiEvents({
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
    state.supportSortSide=state.supportSortSide === 'long' ? 'short' : 'long';
    render();
  });

  document.getElementById('loginButton').addEventListener('click', ()=>openAuthModal('login'));
  document.getElementById('signupButton').addEventListener('click', async ()=>{
    if(state.auth){
      const { error } = await authClient.auth.signOut();
      if(error) document.getElementById('authStatus').textContent=error.message;
      return;
    }
    openAuthModal('signup');
  });
  document.getElementById('authGoogleButton').addEventListener('click', async ()=>{
    document.getElementById('authStatus').textContent=state.lang === 'en' ? 'Opening Google sign-in…' : 'Google 로그인으로 이동 중…';
    const { error } = await signInWithGoogle(window.location.pathname);
    if(error) document.getElementById('authStatus').textContent=error.message;
  });
  document.getElementById('authCloseButton').addEventListener('click', closeAuthModal);
  document.getElementById('authModal').addEventListener('click', e=>{
    if(e.target.id === 'authModal') closeAuthModal();
  });
  document.getElementById('authSubmitButton').addEventListener('click', async ()=>{
    const email=document.getElementById('authEmail').value.trim();
    const password=document.getElementById('authPassword').value;
    if(!email || !email.includes('@')){
      document.getElementById('authStatus').textContent=t('invalidEmail');
      return;
    }
    if(password.length < 6){
      document.getElementById('authStatus').textContent=state.lang === 'en' ? 'Use at least 6 characters for the password.' : '비밀번호는 6자 이상 입력해줘.';
      return;
    }
    const result = state.authMode === 'signup'
      ? await authClient.auth.signUp({ email, password })
      : await authClient.auth.signInWithPassword({ email, password });
    if(result.error){
      document.getElementById('authStatus').textContent=result.error.message;
      return;
    }
    document.getElementById('authStatus').textContent=state.authMode === 'signup'
      ? (state.lang === 'en' ? 'Check your email if confirmation is required.' : '확인 메일이 오면 인증을 완료해줘.')
      : (state.lang === 'en' ? 'Signed in.' : '로그인 완료');
    if(state.authMode !== 'signup' || result.data.session) closeAuthModal();
  });
  document.getElementById('authForm').addEventListener('submit', e=>{
    e.preventDefault();
    document.getElementById('authSubmitButton').click();
  });

}
