export function applyPageTranslations(copy,language,root=document){
  const dictionary=copy[language] || copy.ko || {};
  root.querySelectorAll('[data-page-i18n]').forEach(element=>{
    const value=dictionary[element.dataset.pageI18n];
    if(value != null) element.textContent=value;
  });
  root.querySelectorAll('[data-page-i18n-placeholder]').forEach(element=>{
    const value=dictionary[element.dataset.pageI18nPlaceholder];
    if(value != null) element.placeholder=value;
  });
  if(dictionary.pageTitle) document.title=dictionary.pageTitle;
}
