import React from 'react';

export default function OverviewSection({ analytics, apiStatus, autos, totalEnabled, totalDisabled, error, info, loading, dashSection, chartsReady, Highcharts, HighchartsReact, refreshAnalytics }) {
  const [lastUpdate, setLastUpdate] = React.useState(new Date());
  
  // Update last update time when analytics data changes
  React.useEffect(() => {
    if (analytics) {
      setLastUpdate(new Date());
    }
  }, [analytics]);

  return <div className="overview-section fade-in-soft">
    <h5 className="mb-3 d-flex justify-content-between align-items-center">
      <span>
        Overview
        {analytics?.totals?.guildName && <small className="text-muted ms-2">- {analytics.totals.guildName}</small>}
      </span>
      <div className="d-flex align-items-center">
        <small className="text-muted me-2">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </small>
        {refreshAnalytics && (
          <button 
            className="btn btn-sm btn-outline-secondary" 
            onClick={refreshAnalytics}
            title="Refresh analytics data"
          >
            <i className="fas fa-sync-alt"></i>
          </button>
        )}
      </div>
    </h5>
    {error && <div className="alert alert-danger py-2 mb-2">{error}</div>}
    {info && <div className="alert alert-success py-2 mb-2">{info}</div>}
    {loading && <div className="alert alert-info py-2 mb-2">Loading...</div>}
    <div className="row g-4">
      <div className="col-12 col-lg-5">
        {analytics && <div className="card card-glass shadow-sm h-100"><div className="card-body d-flex flex-column">
          <h6 className="mb-3 text-muted" style={{letterSpacing:'.5px'}}>Quick Statistics</h6>
          <div className="row g-3 mb-3">
            <div className="col-6">
              <div className="mini-stat">
                <div className="mini-label">Autos Enabled</div>
                <div className="mini-value text-accent">{analytics.totals.autosEnabled}</div>
                <div className="mini-sub text-muted">of {analytics.totals.autos}</div>
              </div>
            </div>
            <div className="col-6">
              <div className="mini-stat">
                <div className="mini-label">Commands Enabled</div>
                <div className="mini-value text-success">{analytics.totals.commandsEnabled}</div>
                <div className="mini-sub text-muted">of {analytics.totals.commands}</div>
              </div>
            </div>
            <div className="col-6">
              <div className="mini-stat">
                <div className="mini-label">Autos Disabled</div>
                <div className="mini-value text-danger">{analytics.totals.autos - analytics.totals.autosEnabled}</div>
              </div>
            </div>
            <div className="col-6">
              <div className="mini-stat">
                <div className="mini-label">Commands Disabled</div>
                <div className="mini-value text-danger">{analytics.totals.commandsDisabled}</div>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-6">
              <div className="mini-stat">
                <div className="mini-label">Guild Members</div>
                <div className="mini-value text-info">{analytics.totals.members || 'N/A'}</div>
              </div>
            </div>
            <div className="col-6">
              <div className="mini-stat">
                <div className="mini-label">Commands Today</div>
                <div className="mini-value text-accent">{analytics?.commands?.today || 0}</div>
              </div>
            </div>
            {apiStatus && <div className="col-12">
              <div className="mini-stat api-status-grid small" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:'12px'}}>
                <div className="api-pill">
                  <div className="mini-label">Gemini AI</div>
                  <div className={'mini-value '+(apiStatus.gemini.enabled ? 'text-success':'text-danger')}>{apiStatus.gemini.enabled ? 'On':'Off'}</div>
                  {apiStatus.gemini.model && <div className="mini-sub text-muted">{apiStatus.gemini.model}</div>}
                </div>
                <div className="api-pill">
                  <div className="mini-label">Discord</div>
                  <div className={'mini-value '+(apiStatus.discord.ready ? 'text-success':'text-danger')}>{apiStatus.discord.ready ? 'Ready':'Down'}</div>
                  {apiStatus.discord.ping!=null && <div className="mini-sub text-muted">{apiStatus.discord.ping} ms</div>}
                </div>
                <div className="api-pill">
                  <div className="mini-label">Database</div>
                  <div className={'mini-value '+(apiStatus.database.connected ? 'text-success':'text-danger')}>{apiStatus.database.mode}</div>
                  {apiStatus.database.responseTime && <div className="mini-sub text-muted">{apiStatus.database.responseTime} ms</div>}
                </div>
                <div className="api-pill">
                  <div className="mini-label">Uptime</div>
                  <div className="mini-value text-accent">{Math.floor(apiStatus.uptime.seconds/3600)}h</div>
                  <div className="mini-sub text-muted">{Math.floor((apiStatus.uptime.seconds%3600)/60)}m</div>
                </div>
                {apiStatus.system?.memory && <div className="api-pill">
                  <div className="mini-label">Memory</div>
                  <div className="mini-value text-warning">{apiStatus.system.memory.used} MB</div>
                  <div className="mini-sub text-muted">{apiStatus.system.memory.percentage}% used</div>
                </div>}
                {apiStatus.system?.performance && <div className="api-pill">
                  <div className="mini-label">Errors/Hour</div>
                  <div className={'mini-value '+(apiStatus.system.performance.errorsLastHour > 10 ? 'text-danger' : apiStatus.system.performance.errorsLastHour > 5 ? 'text-warning' : 'text-success')}>{apiStatus.system.performance.errorsLastHour || 0}</div>
                  <div className="mini-sub text-muted">last hour</div>
                </div>}
                {apiStatus.cache && <div className="api-pill">
                  <div className="mini-label">Cache Hit</div>
                  <div className="mini-value text-accent">{Math.round(apiStatus.cache.hitRate * 100)}%</div>
                  <div className="mini-sub text-muted">{apiStatus.cache.entries} entries</div>
                </div>}
              </div>
            </div>}
          </div>
          <div className="flex-grow-1 d-flex flex-column">
            {!chartsReady && dashSection==='overview' && <div className="text-muted small">Loading charts…</div>}
            {chartsReady && HighchartsReact && Highcharts && <HighchartsReact highcharts={Highcharts} options={{
              // Reduced height for better balance; keeps Quick Statistics card tighter
              chart:{ type:'bar', backgroundColor:'transparent', height:220, styledMode:false },
              title:{ text:null },
              xAxis:{ categories:['Autos','Commands'], labels:{ style:{ color:'#9ca3af' } } },
              yAxis:{ min:0, title:{ text:'Count' }, gridLineColor:'rgba(255,255,255,0.08)', labels:{ style:{ color:'#9ca3af' } } },
              legend:{ reversed:true, itemStyle:{ color:'#9ca3af' } },
              plotOptions:{ series:{ stacking:'normal', borderWidth:0 } },
              series:[
                { name:'Disabled', data:[analytics.totals.autos - analytics.totals.autosEnabled, analytics.totals.commandsDisabled], color:'#b81619ff' },
                { name:'Enabled', data:[analytics.totals.autosEnabled, analytics.totals.commandsEnabled], color:'#6366f1' }
              ],
              credits:{ enabled:false },
              tooltip:{ shared:true, backgroundColor:'#111827', borderColor:'#374151', style:{ color:'#f9fafb' } }
            }} />}
            <div className="small text-muted mt-2" style={{opacity:.75}}>Stacked bar compares enabled vs disabled for autos and commands.</div>
          </div>
        </div></div>}
        {!analytics && <div className="card card-glass shadow-sm h-100"><div className="card-body d-flex align-items-center justify-content-center text-muted small">Loading analytics…</div></div>}
      </div>
      <div className="col-12 col-lg-7">
        <div className="stat-cards mb-3">
          <div className="stat-card"><h6>Total Autos</h6><div className="value">{autos.length}</div></div>
          <div className="stat-card"><h6>Enabled</h6><div className="value text-success">{totalEnabled}</div></div>
          <div className="stat-card"><h6>Disabled</h6><div className="value text-danger">{totalDisabled}</div></div>
        </div>
        {analytics && <div className="card card-glass shadow-sm mb-3"><div className="card-body">
          <h6 className="text-muted mb-2" style={{letterSpacing:'.5px'}}>Autos by First Letter</h6>
          {!chartsReady && dashSection==='overview' && <div className="text-muted small">Loading chart…</div>}
          {chartsReady && HighchartsReact && Highcharts && <HighchartsReact highcharts={Highcharts} options={{
            chart:{ type:'column', backgroundColor:'transparent', height:240 },
            title:{ text:null },
            xAxis:{ categories:Object.keys(analytics.autoBuckets), labels:{ style:{ color:'#9ca3af' } } },
            yAxis:{ title:{ text:'Count' }, gridLineColor:'rgba(255,255,255,0.08)', labels:{ style:{ color:'#9ca3af' } } },
            legend:{ enabled:false },
            series:[{ name:'Autos', data:Object.values(analytics.autoBuckets), color:'#5865F2' }],
            credits:{ enabled:false },
            tooltip:{ backgroundColor:'#111827', borderColor:'#374151', style:{ color:'#f9fafb' } }
          }} />}
        </div></div>}
        {analytics && <div className="row g-3">
          <div className="col-md-6">
            <div className="card card-glass shadow-sm h-100"><div className="card-body">
              <h6 className="text-muted mb-2" style={{letterSpacing:'.5px'}}>Commands Enabled vs Disabled</h6>
              {!chartsReady && dashSection==='overview' && <div className="text-muted small">Loading…</div>}
              {chartsReady && HighchartsReact && Highcharts && <HighchartsReact highcharts={Highcharts} options={{
                chart:{ type:'pie', backgroundColor:'transparent', height:220 },
                title:{ text:null },
                tooltip:{ pointFormat:'<b>{point.y}</b> ({point.percentage:.1f}%)' },
                plotOptions:{ pie:{ innerSize:'55%', dataLabels:{ style:{ color:'#e5e7eb', textOutline:'none', fontSize:'11px' } } } },
                series:[{ name:'Commands', data:[
                  { name:'Enabled', y:analytics.totals.commandsEnabled, color:'#10b981' },
                  { name:'Disabled', y:analytics.totals.commandsDisabled, color:'#ef4444' }
                ]}],
                credits:{ enabled:false }
              }} />}
            </div></div>
          </div>
          <div className="col-md-6">
            <div className="card card-glass shadow-sm h-100"><div className="card-body">
              <h6 className="text-muted mb-2" style={{letterSpacing:'.5px'}}>Auto Response Enablement</h6>
              {!chartsReady && dashSection==='overview' && <div className="text-muted small">Loading…</div>}
              {chartsReady && HighchartsReact && Highcharts && <HighchartsReact highcharts={Highcharts} options={{
                chart:{ type:'pie', backgroundColor:'transparent', height:220 },
                title:{ text:null },
                plotOptions:{ pie:{ innerSize:'55%', dataLabels:{ style:{ color:'#e5e7eb', textOutline:'none', fontSize:'11px' } } } },
                tooltip:{ pointFormat:'<b>{point.y}</b> ({point.percentage:.1f}%)' },
                series:[{ name:'Autos', data:[
                  { name:'Enabled', y:analytics.totals.autosEnabled, color:'#6366f1' },
                  { name:'Disabled', y:analytics.totals.autos - analytics.totals.autosEnabled, color:'#4b5563' }
                ]}],
                credits:{ enabled:false }
              }} />}
            </div></div>
          </div>
        </div>}
      </div>
    </div>
    
    {/* Additional Dashboard Information Section */}
    {analytics && <div className="row g-4 mt-2">
      <div className="col-12">
        <div className="card card-glass shadow-sm">
          <div className="card-body">
            <h6 className="text-muted mb-3" style={{letterSpacing:'.5px'}}>System Health & Activity</h6>
            <div className="row g-3">
              <div className="col-md-4">
                <div className="health-metric">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="small text-muted">API Response Time</span>
                    <span className={`badge ${(apiStatus?.system?.performance?.avgResponseTime || 0) < 100 ? 'bg-success' : (apiStatus?.system?.performance?.avgResponseTime || 0) < 300 ? 'bg-warning' : 'bg-danger'}`}>
                      {apiStatus?.system?.performance?.avgResponseTime || 'N/A'} ms
                    </span>
                  </div>
                  <div className="progress" style={{height: '6px'}}>
                    <div 
                      className={`progress-bar ${(apiStatus?.system?.performance?.avgResponseTime || 0) < 100 ? 'bg-success' : (apiStatus?.system?.performance?.avgResponseTime || 0) < 300 ? 'bg-warning' : 'bg-danger'}`}
                      style={{width: `${Math.min((apiStatus?.system?.performance?.avgResponseTime || 0) / 5, 100)}%`}}
                    ></div>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="health-metric">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="small text-muted">Success Rate</span>
                    <span className={`badge ${(apiStatus?.system?.performance?.successRate || 0) > 95 ? 'bg-success' : (apiStatus?.system?.performance?.successRate || 0) > 90 ? 'bg-warning' : 'bg-danger'}`}>
                      {Math.round(apiStatus?.system?.performance?.successRate || 100)}%
                    </span>
                  </div>
                  <div className="progress" style={{height: '6px'}}>
                    <div 
                      className={`progress-bar ${(apiStatus?.system?.performance?.successRate || 0) > 95 ? 'bg-success' : (apiStatus?.system?.performance?.successRate || 0) > 90 ? 'bg-warning' : 'bg-danger'}`}
                      style={{width: `${apiStatus?.system?.performance?.successRate || 100}%`}}
                    ></div>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="health-metric">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="small text-muted">CPU Usage</span>
                    <span className={`badge ${(apiStatus?.system?.cpu?.usage || 0) < 50 ? 'bg-success' : (apiStatus?.system?.cpu?.usage || 0) < 80 ? 'bg-warning' : 'bg-danger'}`}>
                      {Math.round(apiStatus?.system?.cpu?.usage || 0)}%
                    </span>
                  </div>
                  <div className="progress" style={{height: '6px'}}>
                    <div 
                      className={`progress-bar ${(apiStatus?.system?.cpu?.usage || 0) < 50 ? 'bg-success' : (apiStatus?.system?.cpu?.usage || 0) < 80 ? 'bg-warning' : 'bg-danger'}`}
                      style={{width: `${apiStatus?.system?.cpu?.usage || 0}%`}}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="col-md-6">
        <div className="card card-glass shadow-sm h-100">
          <div className="card-body">
            <h6 className="text-muted mb-3" style={{letterSpacing:'.5px'}}>Recent Activity</h6>
            <div className="activity-list">
              {analytics?.activity?.recent ? analytics.activity.recent.slice(0, 5).map((activity, idx) => (
                <div key={idx} className="activity-item d-flex justify-content-between align-items-center py-2">
                  <div className="d-flex align-items-center">
                    <div className={`activity-indicator me-2 ${activity.type === 'command' ? 'bg-primary' : activity.type === 'auto' ? 'bg-info' : 'bg-secondary'}`}></div>
                    <div>
                      <div className="small fw-medium">{activity.action}</div>
                      <div className="extra-small text-muted">{activity.guild || 'Unknown Guild'}</div>
                    </div>
                  </div>
                  <div className="small text-muted">{activity.timestamp ? new Date(activity.timestamp).toLocaleTimeString() : 'N/A'}</div>
                </div>
              )) : (
                <div className="text-muted small text-center py-3">No recent activity data available</div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="col-md-6">
        <div className="card card-glass shadow-sm h-100">
          <div className="card-body">
            <h6 className="text-muted mb-3" style={{letterSpacing:'.5px'}}>Top Commands (24h)</h6>
            <div className="command-stats">
              {analytics?.commands?.top ? analytics.commands.top.slice(0, 5).map((cmd, idx) => (
                <div key={idx} className="command-stat d-flex justify-content-between align-items-center py-2">
                  <div className="d-flex align-items-center">
                    <span className="badge bg-secondary me-2">{idx + 1}</span>
                    <span className="small fw-medium">/{cmd.name}</span>
                  </div>
                  <div className="d-flex align-items-center">
                    <span className="small text-muted me-2">{cmd.count} uses</span>
                    <div className="mini-progress" style={{width: '40px', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px'}}>
                      <div 
                        className="progress-bar bg-primary" 
                        style={{width: `${(cmd.count / (analytics.commands.top[0]?.count || 1)) * 100}%`, height: '100%', borderRadius: '2px'}}
                      ></div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-muted small text-center py-3">No command statistics available</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>}
  </div>;
}
