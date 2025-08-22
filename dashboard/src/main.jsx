import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './theme.css';

function Shell(){
	const [dark, setDark] = useState(() => localStorage.getItem('dash_theme') === 'dark');
	useEffect(()=>{
		document.documentElement.classList.toggle('dark', dark);
		localStorage.setItem('dash_theme', dark ? 'dark':'light');
	}, [dark]);
	return (
		<div className="app-shell">
			<nav className="navbar nav-glass navbar-expand px-3 py-2" style={{position:'sticky', top:0, zIndex:1030}}>
				<span className="navbar-brand brand-title me-auto">Choco Maid</span>
				<div className="d-flex align-items-center gap-2">
					<button className="btn btn-sm toggle-theme-btn" onClick={()=>setDark(d=>!d)} title="Toggle theme">{dark? 'Light':'Dark'}</button>
				</div>
			</nav>
			<div className="flex-grow-1">
				<App />
			</div>
		</div>
	);
}

createRoot(document.getElementById('root')).render(<Shell />);
