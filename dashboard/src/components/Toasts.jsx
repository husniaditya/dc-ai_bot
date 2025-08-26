import React from 'react';

export default function Toasts({ toasts, setToasts }){
  return <div className="toast-holder">{toasts.map(t => <div key={t.id} className={"toast-item toast-"+t.type}>
    <div className="flex-grow-1">{t.message}</div>
    <button className="toast-close" onClick={()=>setToasts(ts=>ts.filter(x=>x.id!==t.id))}>×</button>
  </div>)}</div>;
}
