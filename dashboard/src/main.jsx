import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './theme.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

function Shell(){
	const [dark, setDark] = useState(() => localStorage.getItem('dash_theme') === 'dark');
	useEffect(()=>{
		document.documentElement.classList.toggle('dark', dark);
		localStorage.setItem('dash_theme', dark ? 'dark':'light');
	}, [dark]);
	return (
		<div className="app-shell">
			<nav className="navbar nav-glass navbar-expand px-3 py-2" style={{position:'sticky', top:0, zIndex:1030}}>
				<span className="navbar-brand brand-title me-auto d-flex align-items-center gap-2">
					<img src="/images.jpg" alt="Choco Maid Logo" className="brand-logo" />
					<span>Choco Maid</span>
				</span>
				<div className="d-flex align-items-center gap-3">
					<label className="theme-toggle mb-0" title="Toggle light / dark theme">
						<input type="checkbox" aria-label="Toggle dark mode" checked={dark} onChange={()=>setDark(d=>!d)} />
						<span className="track">
							<span className="icon moon"><i className="fas fa-moon" /></span>
							<span className="icon sun"><i className="fas fa-sun" /></span>
							<span className="thumb" />
						</span>
					</label>
				</div>
			</nav>
			<div className="flex-grow-1">
				<App />
			</div>
		</div>
	);
}

createRoot(document.getElementById('root')).render(<Shell />);
