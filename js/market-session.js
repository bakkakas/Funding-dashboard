export function sessionMinute(time){const m=/^(\d{2}):(\d{2})$/.exec(time||'');if(!m||+m[1]>23||+m[2]>59)return null;return +m[1]*60 + +m[2];}
export function sessionTime(value){return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;}
