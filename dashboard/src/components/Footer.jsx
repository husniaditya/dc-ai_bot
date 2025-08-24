import React from 'react';
export default function Footer(){
  const year = new Date().getFullYear();
  return <footer className="app-footer fade-in-soft"><div className="footer-inner">© {year} Choco Maid • Bot dashboard – Not affiliated with Discord</div></footer>;
}
