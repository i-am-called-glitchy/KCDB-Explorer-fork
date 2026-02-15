// KCDB Explorer -- proof that JavaScript was made in 10 days

(() => {
    'use strict';


    const API_BASE = '/api/messages';

    const TYPE_LABELS = {
        2: 'Chat',
        13: 'Trade',
        20: 'Bot',
    };

    function typeLabel(t) {
        return TYPE_LABELS[t] || `Type ${t}`;
    }
    
    async function fetchMessages(params = {}) {
        const clean = {}; // typeof null === 'object'. the language is gaslighting me
        for (const [k, v] of Object.entries(params)) {
            if (v !== '' && v !== null && v !== undefined) clean[k] = v;
        }
        const qs = new URLSearchParams(clean).toString();
        const res = await fetch(`${API_BASE}${qs ? '?' + qs : ''}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
    }

    // jQuery at home:
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // reinventing React, poorly (thanks stackoverflow)
    function el(tag, attrs = {}, children = []) {
        const e = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (k === 'className') e.className = v;
            else if (k === 'textContent') e.textContent = v;
            else if (k === 'innerHTML') e.innerHTML = v;
            else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
            else e.setAttribute(k, v);
        }
        for (const c of children) {
            if (typeof c === 'string') e.appendChild(document.createTextNode(c));
            else if (c) e.appendChild(c);
        }
        return e;
    }


    let toastTimer;
    function showToast(msg, type = '') {
        const t = $('#toast');
        t.textContent = msg;
        t.className = 'toast show ' + type;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.className = 'toast', 3500);
    }


    function fmtNum(n) {
        if (n === null || n === undefined) return '—';
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
        return n.toLocaleString();
    }

    function timeAgo(dateStr) {
        const d = new Date(dateStr + ' UTC');
        const diff = (Date.now() - d.getTime()) / 1000;
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago'; // close enough for government work
    }


    let currentView = 'dashboard';
    let previousView = 'search';

    function switchView(view) {
        previousView = currentView;
        currentView = view;

        $$('.view').forEach(v => v.classList.remove('active'));
        $(`#view-${view}`).classList.add('active');

        $$('.sidebar-item').forEach(i => i.classList.remove('active'));
        const navItem = $(`#nav-${view}`);
        if (navItem) navItem.classList.add('active');

        $('#nav-user').style.display = view === 'user' ? '' : 'none';
        $('#mainContent').scrollTop = 0;


        $('#sidebar').classList.remove('open');
        $('#sidebarBackdrop').classList.remove('show');

        // touch this and the back button breaks. don't ask me how I know
        if (view !== 'user' && view !== 'context') window.location.hash = view;
    }

    $$('.sidebar-item[data-view]').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view));
    });

    $('#mobileToggle').addEventListener('click', () => {
        $('#sidebar').classList.toggle('open');
        $('#sidebarBackdrop').classList.toggle('show');
    });
    $('#sidebarBackdrop').addEventListener('click', () => {
        $('#sidebar').classList.remove('open');
        $('#sidebarBackdrop').classList.remove('show');
    });


    Chart.defaults.color = 'rgba(255,255,255,0.28)';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;


    const tooltipStyle = {
        backgroundColor: '#252525',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        titleColor: 'rgba(255,255,255,0.88)',
        bodyColor: 'rgba(255,255,255,0.6)',
        padding: 10,
        cornerRadius: 6,
        displayColors: false,
        titleFont: { weight: '600' },
    };

    let chartHourly = null;
    let chartDaily = null;
    let chartTypes = null;

    // I am become death, destroyer of charts
    function destroyCharts() {
        if (chartHourly) { chartHourly.destroy(); chartHourly = null; }
        if (chartDaily) { chartDaily.destroy(); chartDaily = null; }
        if (chartTypes) { chartTypes.destroy(); chartTypes = null; }
    }

    function createHourlyChart(labels, values) {
        const ctx = $('#chartHourly');
        if (!ctx) return;
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 220);
        gradient.addColorStop(0, 'rgba(45, 148, 105, 0.25)');
        gradient.addColorStop(1, 'rgba(45, 148, 105, 0)');

        chartHourly = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data: values,
                    borderColor: '#2d9469',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: '#5bb98c',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2,
                }]
            },
            options: {
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0, font: { size: 10 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { callback: v => fmtNum(v), maxTicksLimit: 5 }, beginAtZero: true }
                },
                plugins: {
                    tooltip: { ...tooltipStyle, callbacks: { label: ctx => `${ctx.parsed.y.toLocaleString()} messages` } }
                }
            }
        });
    }

    function createDailyChart(labels, values) {
        const ctx = $('#chartDaily');
        if (!ctx) return;
        chartDaily = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: 'rgba(45, 148, 105, 0.35)',
                    hoverBackgroundColor: 'rgba(45, 148, 105, 0.6)',
                    borderRadius: 3,
                    borderSkipped: false,
                }]
            },
            options: {
                scales: {
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0, font: { size: 10 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { callback: v => fmtNum(v), maxTicksLimit: 5 }, beginAtZero: true }
                },
                plugins: {
                    tooltip: { ...tooltipStyle, callbacks: { label: ctx => `${ctx.parsed.y.toLocaleString()} messages` } }
                }
            }
        });
    }

    function createTypesChart(labels, values) {
        const colors = ['#2d9469', '#527cc4', '#c4841d', '#9065b0', '#c4554d', '#4aa8a0', '#b07842', '#6e8b3d', '#8f6baf', '#cc7766'];
        const ctx = $('#chartTypes');
        if (!ctx) return;
        chartTypes = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors.slice(0, values.length),
                    borderColor: '#252525',
                    borderWidth: 2,
                }]
            },
            options: {
                cutout: '60%',
                plugins: {
                    legend: {
                        display: true,
                        position: 'right',
                        labels: {
                            color: 'rgba(255,255,255,0.4)',
                            padding: 10,
                            usePointStyle: true,
                            pointStyleWidth: 8,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        ...tooltipStyle,
                        displayColors: true,
                        callbacks: {
                            label: ctx => {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                                return ` ${ctx.parsed.toLocaleString()} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    let dashboardLoaded = false;
    let cachedStats = null;

    // where the magic happens (and sometimes doesn't)
    async function loadDashboard() {
        if (dashboardLoaded) return;

        try {
            let stats = cachedStats;
            if (!stats) {
                const res = await fetch('/api/stats');
                if (!res.ok) throw new Error(`Stats API error: ${res.status}`);
                stats = await res.json();
                cachedStats = stats;
            }


            $('#stat-total').textContent = fmtNum(stats.totalMessages);
            $('#stat-today').textContent = fmtNum(stats.today.count);
            $('#stat-yesterday').textContent = fmtNum(stats.yesterday.count);
            $('#stat-hour').textContent = fmtNum(stats.thisHour);
            $('#stat-avg').textContent = fmtNum(stats.avgDaily);
            $('#stat-users').textContent = fmtNum(stats.uniqueUsers);
            $('#stat-sample').textContent = `from ${fmtNum(stats.sampleSize)} sampled`;

            destroyCharts();


            const hourly = stats.hourlyTimeline || [];
            if (hourly.length > 0) {
                const hourLabels = hourly.map(h => {
                    const parts = h.hour.split(' ');
                    if (parts.length === 2) {
                        const d = new Date(parts[0] + 'T' + parts[1] + ':00:00Z');
                        return `${d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })} ${d.getUTCDate()} ${parts[1]}:00`;
                    }
                    return h.hour;
                });
                createHourlyChart(hourLabels, hourly.map(h => h.count));
            }


            const dayCounts = stats.dayCounts || {};
            const sortedDays = Object.entries(dayCounts).sort((a, b) => a[0].localeCompare(b[0]));
            if (sortedDays.length > 0) {
                const dayLabels = sortedDays.map(([d]) => {
                    const dt = new Date(d + 'T00:00:00Z');
                    return `${dt.toLocaleString('en', { month: 'short', timeZone: 'UTC' })} ${dt.getUTCDate()}`;
                });
                createDailyChart(dayLabels, sortedDays.map(([, c]) => c));
            }


            const typeCounts = stats.typeCounts || {};
            const sortedTypes = Object.entries(typeCounts)
                .map(([type, count]) => [typeLabel(parseInt(type)), count])
                .sort((a, b) => b[1] - a[1]);
            if (sortedTypes.length > 0) {
                createTypesChart(sortedTypes.map(t => t[0]), sortedTypes.map(t => t[1]));
            }


            const topList = $('#topUsersList');
            topList.innerHTML = '';
            (stats.topUsers || []).forEach((user, i) => {
                const rankText = i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}`; // participation trophy for the rest
                const rankClass = i < 3 ? `top-user-rank rank-${i + 1}` : 'top-user-rank';
                topList.appendChild(el('div', { className: 'top-user-item' }, [
                    el('span', { className: rankClass, textContent: rankText }),
                    el('span', { className: 'top-user-name', textContent: user.name, onClick: () => loadUserProfile(user.name, user) }),
                    el('span', { className: 'top-user-count', textContent: `${user.count} msgs` }),
                ]));
            });


            const feed = $('#activityFeed');
            feed.innerHTML = '';
            (stats.recentMessages || []).slice(0, 15).forEach(m => {
                feed.appendChild(el('div', { className: 'activity-item' }, [
                    el('div', { className: 'activity-avatar', textContent: m.user_name[0].toUpperCase() }),
                    el('div', { className: 'activity-content' }, [
                        el('span', {
                            className: 'activity-user', textContent: m.user_name,
                            onClick: () => loadUserProfile(m.user_name, { user_id: m.user_id, short_id: m.user_short_id, level: m.user_level, role: m.user_role }),
                        }),
                        el('span', { textContent: ' ' }),
                        el('span', { className: 'activity-msg', textContent: m.message }),
                    ]),
                    el('span', { className: 'activity-time', textContent: timeAgo(m.received_at) }),
                ]));
            });

            dashboardLoaded = true;
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) overlay.classList.add('hidden');

        } catch (err) {
            console.error('Dashboard load error:', err);
            showToast('Failed to load dashboard data', 'error');
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) overlay.classList.add('hidden');
        }
    }


    let searchState = { lastParams: null, results: [], firstId: null, lastId: null }; // works on my machine™

    function getSearchParams() {
        const p = {};
        const fields = {
            'user_name': 's-username', 'user_id': 's-userid', 'short_id': 's-shortid',
            'message': 's-message', 'message_contains': 's-contains', 'message_type': 's-msgtype',
            'exact_id': 's-exactid', 'since_id': 's-sinceid', 'before_id': 's-beforeid', 'limit': 's-limit',
        };
        for (const [param, id] of Object.entries(fields)) {
            const val = $(`#${id}`).value.trim();
            if (val) p[param] = val;
        }
        return p;
    }

    async function doSearch(params) {
        const container = $('#searchResults');
        container.innerHTML = '<div class="loading-screen"><div class="spinner"></div><span>Searching…</span></div>';

        try {
            const data = await fetchMessages(params);
            searchState.lastParams = { ...params };
            searchState.results = data.results || [];

            if (searchState.results.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-icon">🤷</div><p>No messages found</p></div>';
                return;
            }

            searchState.firstId = searchState.results[0].id;
            searchState.lastId = searchState.results[searchState.results.length - 1].id;
            renderResults(container, data);

        } catch (err) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`;
            showToast('Search failed', 'error');
        }
    }

    // 500 lines of DOM manipulation. mom can we have React? we have React at home
    function renderResults(container, data) {
        const msgs = data.results || [];
        container.innerHTML = '';

        container.appendChild(el('div', { className: 'results-info' }, [
            el('span', { className: 'results-count', textContent: `${data.count || msgs.length} result${msgs.length !== 1 ? 's' : ''}` }),
            el('span', { textContent: msgs.length > 0 ? `ID ${msgs[0].id} → ${msgs[msgs.length - 1].id}` : '' }),
        ]));

        const tableWrap = el('div', { className: 'table-wrap' });
        const tableScroll = el('div', { className: 'table-scroll' });
        const table = el('table');

        const thead = el('thead');
        const headRow = el('tr');
        ['ID', 'Time', 'User', 'Lvl', 'Role', 'Type', 'Message', ''].forEach(h => headRow.appendChild(el('th', { textContent: h })));
        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = el('tbody');
        msgs.forEach(m => {
            const tr = el('tr');
            tr.appendChild(el('td', { className: 'td-id', textContent: m.id }));
            tr.appendChild(el('td', { className: 'td-time', textContent: m.received_at || '—' }));

            const userTd = el('td');
            if (m.user_name) {
                userTd.appendChild(el('span', {
                    className: 'td-user', textContent: m.user_name,
                    onClick: () => loadUserProfile(m.user_name, { user_id: m.user_id, short_id: m.user_short_id, level: m.user_level, role: m.user_role }),
                }));
            } else { userTd.textContent = '—'; }
            tr.appendChild(userTd);

            tr.appendChild(el('td', { className: 'td-level', textContent: m.user_level != null ? m.user_level : '—' }));

            const roleTd = el('td');
            if (m.user_role) {
                roleTd.appendChild(el('span', { className: `td-role role-${m.user_role}`, textContent: m.user_role }));
            } else { roleTd.textContent = '—'; }
            tr.appendChild(roleTd);

            tr.appendChild(el('td', {}, [el('span', { className: 'td-type', textContent: typeLabel(m.type) })]));
            tr.appendChild(el('td', { className: 'td-message', textContent: m.message }));

            const actionTd = el('td');
            actionTd.appendChild(el('button', {
                className: 'btn btn-secondary', style: 'padding:3px 8px;font-size:11px;',
                textContent: 'Context',
                onClick: (e) => { e.stopPropagation(); window.location.hash = 'context/' + m.id; }
            }));
            tr.appendChild(actionTd);
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        const pagination = el('div', { className: 'pagination' });
        pagination.appendChild(el('button', {
            className: 'btn btn-secondary', textContent: '← Newer',
            onClick: () => { const p = { ...searchState.lastParams }; delete p.before_id; delete p.exact_id; p.since_id = searchState.firstId; doSearch(p); },
        }));
        pagination.appendChild(el('span', { className: 'page-info', textContent: `${msgs.length} shown` }));
        pagination.appendChild(el('button', {
            className: 'btn btn-secondary', textContent: 'Older →',
            onClick: () => { const p = { ...searchState.lastParams }; delete p.since_id; delete p.exact_id; p.before_id = searchState.lastId; doSearch(p); },
        }));

        tableScroll.appendChild(table);
        tableWrap.appendChild(tableScroll);
        tableWrap.appendChild(pagination);
        container.appendChild(tableWrap);
    }

    $('#searchBtn').addEventListener('click', () => doSearch(getSearchParams()));
    $$('.search-form input').forEach(input => {
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(getSearchParams()); });
    });
    $('#clearBtn').addEventListener('click', () => {
        $$('.search-form input').forEach(i => i.value = '');
        $('#s-limit').value = '100';
        $('#s-msgtype').value = '';
        $('#searchResults').innerHTML = '<div class="empty-state"><div class="empty-icon">🔎</div><p>Enter filters and hit Search</p></div>';
    });


    async function loadUserProfile(name, info = {}) {
        switchView('user');
        $('#nav-user-label').textContent = name;

        const header = $('#userProfileHeader');
        const statsGrid = $('#userStatsGrid');
        const msgContainer = $('#userMessages');

        header.innerHTML = '';
        header.appendChild(el('div', { className: 'user-avatar', textContent: name[0].toUpperCase() }));
        const infoDiv = el('div', { className: 'user-info' });
        infoDiv.appendChild(el('h2', { textContent: name }));
        const meta = el('div', { className: 'user-meta' });
        if (info.short_id) meta.appendChild(el('span', { innerHTML: `🏷️ ${info.short_id}` }));
        if (info.level != null) meta.appendChild(el('span', { innerHTML: `⭐ Level ${info.level}` }));
        if (info.role) meta.appendChild(el('span', { innerHTML: `🛡️ ${info.role}` }));
        infoDiv.appendChild(meta);
        header.appendChild(infoDiv);

        statsGrid.innerHTML = '';
        msgContainer.innerHTML = '<div class="loading-screen"><div class="spinner"></div><span>Loading…</span></div>';

        try {
            const searchParam = info.user_id ? { user_id: info.user_id } : { user_name: name };
            const data = await fetchMessages({ ...searchParam, limit: 1000 });
            const msgs = data.results || [];

            statsGrid.innerHTML = '';
            const uniqueDays = new Set(msgs.map(m => m.received_at?.slice(0, 10))).size;
            const typeCounts = {};
            msgs.forEach(m => { const t = typeLabel(m.type); typeCounts[t] = (typeCounts[t] || 0) + 1; });
            const mostCommonType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
            const lastSeen = msgs.length > 0 ? msgs[0].received_at : '—';
            const firstSeen = msgs.length > 0 ? msgs[msgs.length - 1].received_at : '—';

            [
                { label: '💬 Messages (sample)', value: fmtNum(msgs.length), cls: 'accent' },
                { label: '📅 Active Days', value: uniqueDays, cls: 'success' },
                { label: '🏷️ Most Common Type', value: mostCommonType ? mostCommonType[0] : '—', cls: 'warning' },
                { label: '🕐 Last Seen', value: lastSeen ? timeAgo(lastSeen) : '—', cls: 'purple' },
            ].forEach(c => {
                statsGrid.appendChild(el('div', { className: `stat-card ${c.cls}` }, [
                    el('div', { className: 'stat-label', textContent: c.label }),
                    el('div', { className: 'stat-value', textContent: c.value }),
                ]));
            });

            if (msgs.length > 0) {
                statsGrid.appendChild(el('div', { className: 'stat-card' }, [
                    el('div', { className: 'stat-label', textContent: '📆 First Seen' }),
                    el('div', { className: 'stat-value', textContent: timeAgo(firstSeen), style: 'font-size: 16px' }),
                    el('div', { className: 'stat-sub', textContent: firstSeen }),
                ]));
            }

            if (msgs.length === 0) {
                msgContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">🤷</div><p>No messages found</p></div>';
                return;
            }
            renderResults(msgContainer, data);

        } catch (err) {
            msgContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${err.message}</p></div>`;
        }
    }

    $('#backFromUser').addEventListener('click', () => switchView(previousView)); // the entire routing layer is 3 event listeners

    // praying this works every single time it runs
    async function loadContextView(messageId) {
        if (currentView !== 'context') switchView('context');

        const contextListEl = $('#contextList');
        if (!contextListEl) return;
        contextListEl.innerHTML = '<div class="loading-screen"><div class="spinner"></div><span>Loading context…</span></div>';

        try {
            const [beforeData, afterData, currentMsgData] = await Promise.all([
                fetchMessages({ before_id: messageId, limit: 15 }),
                fetchMessages({ since_id: messageId, limit: 15 }),
                fetchMessages({ exact_id: messageId })
            ]);

            const before = (beforeData.results || []).reverse();
            const after = (afterData.results || []);
            const current = currentMsgData.results?.length > 0
                ? currentMsgData.results[0]
                : { id: parseInt(messageId), message: '[Message not found]', received_at: '—', user_name: 'Unknown' };

            renderContextList(contextListEl, [...before, current, ...after], parseInt(messageId));
        } catch (err) {
            contextListEl.innerHTML = `<div class="empty-state"><p>Failed to load context: ${err.message}</p></div>`;
        }
    }

    function renderContextList(containerEl, messages, anchorId) {
        containerEl.innerHTML = '';
        if (messages.length === 0) {
            containerEl.innerHTML = '<div class="empty-state"><p>No context found</p></div>';
            return;
        }
        messages.forEach(m => {
            const isAnchor = m.id === anchorId;
            const item = el('div', { className: `context-item ${isAnchor ? 'anchor' : ''}` });

            const meta = el('div', { className: 'context-meta' });
            const userSpan = el('span', { className: 'context-user', textContent: m.user_name || 'System' });
            userSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                if (m.user_name) loadUserProfile(m.user_name, { user_id: m.user_id, level: m.user_level, role: m.user_role });
            });
            meta.appendChild(userSpan);
            meta.appendChild(el('span', { className: 'context-time', textContent: m.received_at }));
            meta.appendChild(el('span', { className: 'context-time', style: 'font-family:monospace;opacity:0.5', textContent: `#${m.id}` }));
            item.appendChild(meta);
            item.appendChild(el('div', { className: 'context-msg', textContent: m.message }));
            containerEl.appendChild(item);

            if (isAnchor) setTimeout(() => item.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
        });
    }

    $('#backFromContext').addEventListener('click', () => switchView(previousView));


    // the poor man's Next.js
    function handleHash() {
        const hash = window.location.hash.slice(1) || 'dashboard';
        if (hash.startsWith('context/')) {
            const msgId = hash.split('/')[1];
            if (msgId) loadContextView(msgId);
            return;
        }
        if (['dashboard', 'search', 'about', 'context'].includes(hash)) {
            switchView(hash);
            if (hash === 'dashboard') { dashboardLoaded = false; loadDashboard(); }
        }
    }

    window.addEventListener('hashchange', handleHash);

    // ignition sequence
    handleHash();
    loadDashboard();


    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (currentView === 'dashboard' && !dashboardLoaded && cachedStats) {
                dashboardLoaded = false;
                loadDashboard();
            }
        }, 250);
    });

})();

