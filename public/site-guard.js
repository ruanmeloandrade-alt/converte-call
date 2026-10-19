'use strict';
// The marketing and onboarding pages must remain usable with older installed versions.
(()=>{const remove=()=>document.getElementById('converte-call-native-root')?.remove();remove();new MutationObserver(remove).observe(document.documentElement,{childList:true,subtree:true});})();
