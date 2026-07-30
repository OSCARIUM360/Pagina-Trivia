document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromQR = urlParams.get('room');
    window.game = new JeopardyGame(roomFromQR);
});

class JeopardyGame {
    constructor(roomFromQR) {
        this.categories = [];
        this.questions = [];
        this.players = [];
        this.currentPlayer = 0;
        this.totalCategories = 0;
        this.questionsPerCategory = 0;
        this.currentQuestion = null;
        this.gameStarted = false;
        this.answerRevealed = false;
        this.isHost = false;
        this.roomCode = '';
        this.peer = null;
        this.connections = [];
        this.joinedNames = new Set();
        this.musicPlaying = false;
        this.playerName = '';
        this.sortedPlayers = [];
        this.roomFromQR = roomFromQR;
        this.jumpEnabled = false;
        this.hardMode = false;
        this.questionJumped = false;
        this.originalPlayer = 0;

        this.setupMusic();
        this.bindEvents();
        
        if (this.restoreState()) {
            console.log('Estado restaurado');
        } else if (roomFromQR) {
            this.showQRJoinScreen(roomFromQR);
        } else {
            this.showScreen('home-screen');
        }
    }

    // ==================== MÚSICA ====================
    setupMusic() {
        this.bgMusic = document.getElementById('bg-music');
        this.gameMusic = document.getElementById('game-music');
        if (this.bgMusic) this.bgMusic.volume = 0.15;
        if (this.gameMusic) this.gameMusic.volume = 0.2;
    }

    startGameMusic() {
        if (this.bgMusic) { this.bgMusic.pause(); this.bgMusic.currentTime = 0; }
        if (this.gameMusic) this.gameMusic.play().catch(() => {});
    }

    stopGameMusic() {
        if (this.gameMusic) { this.gameMusic.pause(); this.gameMusic.currentTime = 0; }
    }

    playSound(type) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (type === 'select') this._playTone(ctx, 660, 0.08, 'sine');
            else if (type === 'correct') { this._playTone(ctx, 523, 0.12, 'sine'); setTimeout(() => { try { this._playTone(ctx, 659, 0.12, 'sine'); } catch(e) {} }, 100); setTimeout(() => { try { this._playTone(ctx, 784, 0.2, 'sine'); } catch(e) {} }, 200); }
            else if (type === 'incorrect') this._playTone(ctx, 200, 0.3, 'sawtooth');
            else if (type === 'jump') this._playTone(ctx, 440, 0.15, 'triangle');
            else if (type === 'win') { [523, 659, 784, 1047].forEach((f, i) => { setTimeout(() => { try { this._playTone(ctx, f, 0.2, 'sine'); } catch(e) {} }, i * 150); }); }
        } catch(e) {}
    }

    _playTone(ctx, freq, dur, type) {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = type;
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
    }

    // ==================== PERSISTENCIA ====================
    saveState() {
        const state = {
            categories: this.categories, questions: this.questions, players: this.players,
            currentPlayer: this.currentPlayer, totalCategories: this.totalCategories,
            questionsPerCategory: this.questionsPerCategory, gameStarted: this.gameStarted,
            isHost: this.isHost, roomCode: this.roomCode, currentScreen: this.getCurrentScreen(),
            jumpEnabled: this.jumpEnabled, hardMode: this.hardMode
        };
        localStorage.setItem('jeopardy-state', JSON.stringify(state));
    }

    restoreState() {
        const saved = localStorage.getItem('jeopardy-state');
        if (!saved) return false;
        try {
            const state = JSON.parse(saved);
            if (!state.isHost || !state.roomCode) return false;
            Object.assign(this, state);
            this.joinedNames = new Set(this.players.map(p => p.name));
            this.initPeer(this.roomCode + '-host');
            if (state.currentScreen) {
                this.showScreen(state.currentScreen);
                if (state.currentScreen === 'lobby-screen') { this.updateLobby(); this.updateOptionsUI(); }
                else if (state.currentScreen === 'game-screen') this.renderBoard();
                else if (state.currentScreen === 'categories-screen') this.showCategoriesScreen();
                else if (state.currentScreen === 'questions-screen') this.showQuestionsScreen();
            }
            return true;
        } catch (e) { return false; }
    }

    clearState() { localStorage.removeItem('jeopardy-state'); }
    getCurrentScreen() { const a = document.querySelector('.screen.active'); return a ? a.id : 'home-screen'; }

    // ==================== QR ====================
    showQRJoinScreen(code) {
        this.roomCode = code; this.isHost = false;
        document.getElementById('join-form').classList.remove('hidden');
        document.getElementById('room-code').value = code;
        document.getElementById('room-code').disabled = true;
        document.getElementById('join-player-name').focus();
        document.querySelector('.home-actions').style.display = 'none';
        document.querySelector('.trivia-actions').style.display = 'none';
        this.showScreen('home-screen');
    }

    // ==================== EVENTOS ====================
    bindEvents() {
        this.onClick('create-room-btn', () => this.createRoom());
        this.onClick('join-room-btn', () => { document.getElementById('join-form').classList.remove('hidden'); document.getElementById('room-code').disabled = false; document.getElementById('room-code').value = ''; document.querySelector('.home-actions').style.display = 'flex'; document.querySelector('.trivia-actions').style.display = 'flex'; });
        this.onClick('join-room-submit', () => this.joinRoom());
        this.onClick('cancel-join', () => { document.getElementById('join-form').classList.add('hidden'); document.querySelector('.home-actions').style.display = 'flex'; document.querySelector('.trivia-actions').style.display = 'flex'; if (this.roomFromQR) window.location.href = window.location.pathname; });
        this.onClick('toggle-music', () => this.toggleMusic());
        this.onClick('load-trivia-btn', () => document.getElementById('load-trivia-form').classList.remove('hidden'));
        this.onClick('load-trivia-submit', () => this.importTrivia());
        this.onClick('cancel-load-trivia', () => document.getElementById('load-trivia-form').classList.add('hidden'));
        this.onClick('back-to-home', () => this.disconnect());
        this.onClick('create-board', () => this.createBoard());
        this.onClick('back-to-setup', () => { this.showScreen('setup-screen'); this.saveState(); });
        this.onClick('submit-categories', () => this.submitCategories());
        this.onClick('back-to-categories', () => { this.showCategoriesScreen(); this.saveState(); });
        this.onClick('submit-questions', () => this.submitQuestions());
        this.onClick('back-to-questions', () => { this.showScreen('questions-screen'); this.saveState(); });
        this.onClick('export-trivia', () => this.exportTrivia());
        this.onClick('start-game-lobby', () => this.startGame());
        this.onClick('leave-lobby', () => this.leaveLobby());
        this.onClick('end-game', () => this.endGame());
        this.onClick('btn-correct', () => this.handleAnswer(true));
        this.onClick('btn-incorrect', () => this.handleAnswer(false));
        this.onClick('btn-jump', () => this.jumpQuestion());
        this.onClick('show-full-results', () => this.toggleFullResults());
        this.onClick('new-game', () => this.disconnect());
        
        // Manual points
        this.onClick('btn-add-100', () => this.adjustPoints(100));
        this.onClick('btn-add-200', () => this.adjustPoints(200));
        this.onClick('btn-add-500', () => this.adjustPoints(500));
        this.onClick('btn-sub-100', () => this.adjustPoints(-100));
        this.onClick('btn-sub-200', () => this.adjustPoints(-200));
        this.onClick('btn-sub-500', () => this.adjustPoints(-500));
        
        const closeBtn = document.querySelector('#question-modal .close');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
        
        // Options
        const jumpCheck = document.getElementById('option-jump');
        const hardCheck = document.getElementById('option-hard');
        if (jumpCheck) jumpCheck.addEventListener('change', () => { this.jumpEnabled = jumpCheck.checked; this.saveState(); });
        if (hardCheck) hardCheck.addEventListener('change', () => { this.hardMode = hardCheck.checked; this.saveState(); });
        
        const roomInput = document.getElementById('room-code');
        const nameInput = document.getElementById('join-player-name');
        if (roomInput && nameInput) {
            roomInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') nameInput.focus(); });
            nameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.joinRoom(); });
        }
        
        window.addEventListener('beforeunload', () => { if (this.isHost && this.roomCode) this.saveState(); });
    }

    onClick(id, handler) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
    }

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(id);
        if (screen) screen.classList.add('active');
        
        const hostControls = document.getElementById('host-controls');
        const lobbyHostActions = document.getElementById('lobby-host-actions');
        const lobbyPlayerActions = document.getElementById('lobby-player-actions');
        const gameOptions = document.getElementById('game-options');
        
        if (hostControls) hostControls.style.display = this.isHost ? 'flex' : 'none';
        if (lobbyHostActions) lobbyHostActions.style.display = this.isHost ? 'flex' : 'none';
        if (lobbyPlayerActions) lobbyPlayerActions.style.display = (!this.isHost && id === 'lobby-screen') ? 'flex' : 'none';
        if (gameOptions) gameOptions.classList.toggle('hidden', !this.isHost || id !== 'lobby-screen');
        
        if (id === 'lobby-screen') this.updateOptionsUI();
        if (this.isHost) this.saveState();
    }

    updateOptionsUI() {
        const jumpCheck = document.getElementById('option-jump');
        const hardCheck = document.getElementById('option-hard');
        if (jumpCheck) jumpCheck.checked = this.jumpEnabled;
        if (hardCheck) hardCheck.checked = this.hardMode;
    }

    toggleMusic() {
        const btn = document.getElementById('toggle-music');
        if (this.musicPlaying) {
            if (this.bgMusic) this.bgMusic.pause();
            if (this.gameMusic) this.gameMusic.pause();
            if (btn) btn.innerHTML = '<i class="fas fa-music"></i>';
        } else {
            if (this.gameStarted) { if (this.gameMusic) this.gameMusic.play().catch(() => {}); }
            else { if (this.bgMusic) this.bgMusic.play().catch(() => {}); }
            if (btn) btn.innerHTML = '<i class="fas fa-volume-up"></i>';
        }
        this.musicPlaying = !this.musicPlaying;
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        return code;
    }

    // ==================== CONEXIÓN ====================
    createRoom() {
        this.clearState(); this.isHost = true; this.roomCode = this.generateRoomCode();
        this.players = [{ name: 'Host', score: 0, id: 'host', isHost: true }];
        this.joinedNames = new Set(['Host']);
        this.initPeer(this.roomCode + '-host');
        this.showScreen('setup-screen'); this.saveState();
    }

    joinRoom() {
        const code = document.getElementById('room-code').value.trim().toUpperCase();
        const name = document.getElementById('join-player-name').value.trim();
        if (!name) return alert('Ingresa tu nombre');
        if (!code || code.length !== 6) return alert('El código debe tener 6 caracteres');
        const btn = document.getElementById('join-room-submit');
        btn.disabled = true; btn.textContent = 'Conectando...';
        this.roomCode = code; this.isHost = false; this.playerName = name;
        // Guardar para reconexión
        sessionStorage.setItem('jeopardy-player-code', code);
        sessionStorage.setItem('jeopardy-player-name', name);
        this.initPeer(code + '-player-' + Date.now());
    }

    initPeer(id) {
        if (this.peer) { this.peer.destroy(); this.peer = null; }
        this.peer = new Peer(id, { debug: 0, config: { 'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] } });
        this.peer.on('open', (peerId) => {
            if (!this.isHost) setTimeout(() => { const conn = this.peer.connect(this.roomCode + '-host', { reliable: true, metadata: { name: this.playerName } }); this.handleConnection(conn); }, 500);
        });
        this.peer.on('connection', (conn) => this.handleConnection(conn));
        this.peer.on('error', (err) => { if (!this.isHost) { alert('Error de conexión. Verifica el código.'); const btn = document.getElementById('join-room-submit'); if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; } } });
        this.peer.on('disconnected', () => { if (this.peer && !this.peer.destroyed) this.peer.reconnect(); });
    }

    handleConnection(conn) {
        if (this.connections.find(c => c.peer === conn.peer)) { conn.close(); return; }
        this.connections.push(conn);
        conn.on('open', () => {
            if (this.isHost) conn.send({ type: 'welcome', players: this.players, gameStarted: this.gameStarted, categories: this.categories, questions: this.questions, totalCategories: this.totalCategories, questionsPerCategory: this.questionsPerCategory, currentPlayer: this.currentPlayer, jumpEnabled: this.jumpEnabled, hardMode: this.hardMode });
            else conn.send({ type: 'join-request', name: this.playerName });
        });
        conn.on('data', (data) => this.handleData(conn, data));
        conn.on('close', () => {
            this.connections = this.connections.filter(c => c !== conn);
            if (this.isHost && conn.metadata?.name) {
                this.players = this.players.filter(p => p.name !== conn.metadata.name);
                this.joinedNames.delete(conn.metadata.name);
                this.broadcastPlayers(); this.updateLobby(); this.saveState();
            }
        });
    }

    handleData(conn, data) {
        if (!this.isHost) {
            switch (data.type) {
                case 'welcome': this.players = data.players || []; this.jumpEnabled = data.jumpEnabled || false; this.hardMode = data.hardMode || false; this.updateLobby(); if (data.gameStarted) { this.loadGameState(data); this.renderBoard(); this.showScreen('game-screen'); } else this.showLobby(); const btn = document.getElementById('join-room-submit'); if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; } if (window.location.search) window.history.replaceState({}, '', window.location.pathname); break;
                case 'players-update': this.players = data.players; this.updateLobby(); break;
                case 'game-start': this.loadGameState(data); this.renderBoard(); this.showScreen('game-screen'); this.startGameMusic(); break;
                case 'game-update': this.applyGameUpdate(data); break;
                case 'question-selected': this.showQuestionForPlayers(data); break;
                case 'answer-result': this.showAnswerForPlayers(data); break;
                case 'jump-notification': this.showJumpNotification(data); break;
                case 'close-modal': document.getElementById('question-modal').classList.remove('active'); break;
                case 'game-end': this.players = data.players; this.gameStarted = false; document.getElementById('question-modal').classList.remove('active'); this.stopGameMusic(); this.showResults(); this.playSound('win'); break;
                case 'kicked': alert('Has sido eliminado de la sala'); this.disconnect(); break;
            }
        } else {
            if (data.type === 'join-request') this.handleJoinRequest(conn, data);
            else if (data.type === 'leave-request') this.handleLeaveRequest(conn, data);
        }
    }

    handleJoinRequest(conn, data) {
        const name = data.name?.trim();
        if (!name) return;
        if (this.joinedNames.has(name)) { conn.send({ type: 'error', message: 'Nombre ya en uso' }); return; }
        if (this.gameStarted) { conn.send({ type: 'error', message: 'Juego en curso' }); return; }
        this.players.push({ name, score: 0, id: conn.peer, isHost: false });
        this.joinedNames.add(name);
        conn.metadata = { name };
        conn.send({ type: 'join-accepted', players: this.players });
        this.broadcastPlayers(); this.updateLobby(); this.saveState();
    }

    handleLeaveRequest(conn, data) {
        const name = conn.metadata?.name;
        if (name) {
            this.players = this.players.filter(p => p.name !== name);
            this.joinedNames.delete(name);
            this.broadcastPlayers(); this.updateLobby(); this.saveState();
        }
    }

    leaveLobby() {
        if (this.isHost) return;
        if (this.connections.length > 0) {
            this.connections[0].send({ type: 'leave-request' });
        }
        sessionStorage.removeItem('jeopardy-player-code');
        sessionStorage.removeItem('jeopardy-player-name');
        this.disconnect();
    }

    broadcast(data) { this.connections.forEach(c => { if (c.open) { try { c.send(data); } catch(e) {} } }); }
    broadcastPlayers() { this.broadcast({ type: 'players-update', players: this.players }); }

    loadGameState(data) {
        this.categories = data.categories || []; this.questions = data.questions || [];
        this.players = data.players || []; this.totalCategories = data.totalCategories || 0;
        this.questionsPerCategory = data.questionsPerCategory || 0; this.currentPlayer = data.currentPlayer || 0;
        this.gameStarted = true; this.jumpEnabled = data.jumpEnabled || false; this.hardMode = data.hardMode || false;
    }

    applyGameUpdate(data) {
        if (data.questionId !== undefined) { const q = this.questions.find(q => q.id === data.questionId); if (q) q.used = true; }
        if (data.players) this.players = data.players;
        if (data.currentPlayer !== undefined) this.currentPlayer = data.currentPlayer;
        this.renderBoard();
    }

    // ==================== CONFIGURACIÓN ====================
    createBoard() {
        if (!this.isHost) return;
        this.totalCategories = parseInt(document.getElementById('categories').value);
        this.questionsPerCategory = parseInt(document.getElementById('questions').value);
        if (this.totalCategories < 2 || this.totalCategories > 8 || this.questionsPerCategory < 1 || this.questionsPerCategory > 10) return alert('2-8 categorías, 1-10 preguntas');
        this.showCategoriesScreen(); this.saveState();
    }

    showCategoriesScreen() {
        if (!this.isHost) return;
        const container = document.getElementById('category-inputs');
        container.innerHTML = '';
        for (let i = 0; i < this.totalCategories; i++) {
            const div = document.createElement('div'); div.className = 'category-input';
            div.innerHTML = `<label>Categoría ${i + 1}</label><input type="text" class="category-name" placeholder="Ej: Ciencia" value="${this.categories[i] || ''}">`;
            container.appendChild(div);
        }
        this.showScreen('categories-screen');
    }

    submitCategories() {
        if (!this.isHost) return;
        const inputs = document.querySelectorAll('.category-name'); this.categories = []; let valid = true;
        inputs.forEach((input, i) => { const name = input.value.trim(); if (!name) { alert(`Nombre para Categoría ${i + 1}`); valid = false; } this.categories.push(name); });
        if (valid) { this.showQuestionsScreen(); this.saveState(); }
    }

    showQuestionsScreen() {
        if (!this.isHost) return;
        const container = document.getElementById('questions-container'); container.innerHTML = '';
        const existingQuestions = [...this.questions]; this.questions = []; let id = 0;
        this.categories.forEach(cat => {
            for (let i = 0; i < this.questionsPerCategory; i++) {
                const existing = existingQuestions.find(q => q.category === cat && q.points === (i + 1) * 100);
                const q = existing || { id, category: cat, points: (i + 1) * 100, question: '', answer: '', used: false };
                q.id = id; this.questions.push(q);
                const div = document.createElement('div'); div.className = 'question-row';
                div.innerHTML = `<h3>${cat} — ${q.points} pts</h3><div class="question-inputs"><textarea class="q-input" placeholder="Pregunta" data-id="${id}">${q.question || ''}</textarea><textarea class="a-input" placeholder="Respuesta" data-id="${id}">${q.answer || ''}</textarea></div>`;
                container.appendChild(div); id++;
            }
        });
        this.showScreen('questions-screen');
    }

    submitQuestions() {
        if (!this.isHost) return;
        const qInputs = document.querySelectorAll('.q-input'); const aInputs = document.querySelectorAll('.a-input'); let valid = true;
        qInputs.forEach(input => { const id = parseInt(input.dataset.id); const q = this.questions.find(q => q.id === id); if (q) q.question = input.value.trim(); if (!q || !q.question) { alert('Falta pregunta'); valid = false; } });
        aInputs.forEach(input => { const id = parseInt(input.dataset.id); const q = this.questions.find(q => q.id === id); if (q) q.answer = input.value.trim(); if (!q || !q.answer) { alert('Falta respuesta'); valid = false; } });
        if (valid) { this.showLobby(); this.saveState(); }
    }

    // ==================== EXPORTAR/IMPORTAR ====================
    exportTrivia() {
        if (!this.isHost) return;
        const qInputs = document.querySelectorAll('.q-input'); const aInputs = document.querySelectorAll('.a-input');
        qInputs.forEach(input => { const id = parseInt(input.dataset.id); const q = this.questions.find(q => q.id === id); if (q) q.question = input.value.trim(); });
        aInputs.forEach(input => { const id = parseInt(input.dataset.id); const q = this.questions.find(q => q.id === id); if (q) q.answer = input.value.trim(); });
        if (this.questions.length === 0) return alert('Primero crea las preguntas');
        if (this.questions.some(q => !q.question || !q.answer)) return alert('Completa todas las preguntas y respuestas');
        const data = { v: 1, c: this.categories, qpc: this.questionsPerCategory, q: this.questions.map(q => ({ cat: q.category, pts: q.points, q: q.question, a: q.answer })) };
        const code = 'JPTV' + btoa(unescape(encodeURIComponent(JSON.stringify(data))));
        this.copyToClipboard(code); this.showToast('✅ ¡Código copiado!');
    }

    importTrivia() {
        const codeInput = document.getElementById('trivia-code-input'); const code = codeInput.value.trim();
        if (!code) return alert('Pega el código'); if (!code.startsWith('JPTV')) return alert('Código inválido');
        try {
            const jsonStr = decodeURIComponent(escape(atob(code.substring(4)))); const data = JSON.parse(jsonStr);
            const categories = data.c || data.categories; const qpc = data.qpc || data.questionsPerCategory;
            const questions = data.q ? data.q.map(q => ({ category: q.cat, points: q.pts, question: q.q, answer: q.a })) : data.questions.map(q => ({ category: q.category, points: q.points, question: q.question, answer: q.answer }));
            this.clearState(); this.isHost = true; this.categories = categories; this.totalCategories = categories.length; this.questionsPerCategory = qpc;
            this.questions = questions.map((q, i) => ({ id: i, category: q.category, points: q.points, question: q.question, answer: q.answer, used: false }));
            this.roomCode = this.generateRoomCode(); this.players = [{ name: 'Host', score: 0, id: 'host', isHost: true }]; this.joinedNames = new Set(['Host']); this.gameStarted = false;
            document.getElementById('load-trivia-form').classList.add('hidden'); codeInput.value = '';
            this.initPeer(this.roomCode + '-host'); this.showLobby(); this.saveState();
            this.showToast('✅ ¡Trivia cargada! ' + this.totalCategories + ' categorías, ' + this.questions.length + ' preguntas');
        } catch (e) { alert('Error al cargar. Código incompleto.'); }
    }

    copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).catch(() => this.fallbackCopy(text));
        else this.fallbackCopy(text);
    }

    fallbackCopy(text) {
        const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch(e) {}
        document.body.removeChild(ta);
    }

    showToast(msg) {
        const ex = document.querySelector('.export-toast'); if (ex) ex.remove();
        const t = document.createElement('div'); t.className = 'export-toast'; t.textContent = msg;
        document.body.appendChild(t); setTimeout(() => { if (t.parentNode) t.remove(); }, 3000);
    }

    // ==================== LOBBY ====================
    showLobby() {
        document.getElementById('room-code-display').textContent = this.roomCode;
        setTimeout(() => this.generateQR(), 300); this.updateLobby(); this.showScreen('lobby-screen');
        document.getElementById('lobby-status').textContent = this.isHost ? '' : '⏳ Esperando al host...';
        this.saveState();
    }

    generateQR() {
        const container = document.getElementById('qrcode'); if (!container) return; container.innerHTML = '';
        const url = window.location.origin + window.location.pathname + '?room=' + this.roomCode;
        try { if (typeof QRCode !== 'undefined') new QRCode(container, { text: url, width: 150, height: 150, colorDark: '#1e293b', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }); } catch(e) { container.innerHTML = '<p style="font-size:0.8rem;">' + url + '</p>'; }
    }

    updateLobby() {
        const container = document.getElementById('lobby-players-list'); if (!container) return; container.innerHTML = '';
        this.players.forEach(p => { const tag = document.createElement('div'); tag.className = 'player-tag' + (p.isHost ? ' host' : ''); tag.innerHTML = (p.isHost ? '👑 ' : '') + p.name; container.appendChild(tag); });
    }

    // ==================== JUEGO ====================
    startGame() {
        if (!this.isHost) return;
        if (this.players.length < 2) return alert('Mínimo 2 jugadores');
        this.gameStarted = true;
        this.currentPlayer = this.players.findIndex(p => !p.isHost);
        if (this.currentPlayer < 0) this.currentPlayer = 0;
        this.broadcast({ type: 'game-start', categories: this.categories, questions: this.questions.map(q => ({ ...q, answer: '' })), players: this.players, totalCategories: this.totalCategories, questionsPerCategory: this.questionsPerCategory, currentPlayer: this.currentPlayer, jumpEnabled: this.jumpEnabled, hardMode: this.hardMode });
        this.renderBoard(); this.showScreen('game-screen'); this.startGameMusic(); this.saveState();
    }

    renderBoard() {
        const board = document.getElementById('game-board'); if (!board) return; board.innerHTML = '';
        board.style.gridTemplateColumns = `repeat(${this.totalCategories + 1}, 1fr)`;
        const ph = document.createElement('div'); ph.className = 'game-cell category'; ph.textContent = 'Pts'; board.appendChild(ph);
        this.categories.forEach(cat => { const h = document.createElement('div'); h.className = 'game-cell category'; h.textContent = cat; board.appendChild(h); });
        for (let i = 0; i < this.questionsPerCategory; i++) {
            const pc = document.createElement('div'); pc.className = 'game-cell category'; pc.textContent = (i + 1) * 100; board.appendChild(pc);
            this.categories.forEach(cat => {
                const q = this.questions.find(q => q.category === cat && q.points === (i + 1) * 100);
                const cell = document.createElement('div'); cell.className = `game-cell ${q?.used ? 'used' : 'clickable'}`;
                cell.textContent = q?.used ? '✓' : (i + 1) * 100;
                if (!q?.used && this.isHost) cell.addEventListener('click', () => this.selectQuestion(q));
                board.appendChild(cell);
            });
        }
        this.renderPlayers(); this.updateTurnIndicator();
    }

    renderPlayers() {
        const bar = document.getElementById('players-bar'); if (!bar) return; bar.innerHTML = '';
        this.players.forEach((p, i) => {
            const div = document.createElement('div'); div.className = `player-score ${i === this.currentPlayer ? 'active' : ''}`;
            div.innerHTML = `<strong>${p.name}</strong><br>${p.score} pts`;
            if (this.isHost) {
                div.style.cursor = 'pointer';
                div.addEventListener('click', () => {
                    if (!document.getElementById('question-modal').classList.contains('active')) { this.currentPlayer = i; this.renderBoard(); this.broadcast({ type: 'game-update', currentPlayer: this.currentPlayer }); this.saveState(); }
                });
            }
            bar.appendChild(div);
        });
    }

    updateTurnIndicator() {
        const ind = document.getElementById('turn-indicator');
        if (ind && this.players[this.currentPlayer]) ind.textContent = `🎯 Turno de: ${this.players[this.currentPlayer].name}`;
    }

    selectQuestion(q) {
        if (!this.isHost || q.used || !this.gameStarted) return;
        this.playSound('select');
        this.currentQuestion = q; this.answerRevealed = false; this.questionJumped = false;
        this.originalPlayer = this.currentPlayer;
        
        document.getElementById('modal-category').textContent = `${q.category} — ${q.points} pts`;
        document.getElementById('modal-question').textContent = q.question;
        document.getElementById('modal-answer').classList.add('hidden');
        document.getElementById('answer-buttons').style.display = 'flex';
        document.getElementById('manual-points').classList.add('hidden');
        
        // Botón de saltar
        const jumpBtn = document.getElementById('btn-jump');
        if (jumpBtn) jumpBtn.classList.toggle('hidden', !this.jumpEnabled);
        
        // Textos de botones
        this.updateButtonTexts();
        this.updateTurnIndicatorModal();
        
        const closeBtn = document.querySelector('#question-modal .close');
        if (closeBtn) closeBtn.style.display = 'flex';
        
        document.getElementById('question-modal').classList.add('active');
        this.broadcast({ type: 'question-selected', category: q.category, points: q.points, question: q.question, currentPlayer: this.currentPlayer });
    }

    updateButtonTexts() {
        if (!this.currentQuestion) return;
        const pts = this.currentQuestion.points;
        document.getElementById('btn-correct-text').textContent = `Correcto +${pts}`;
        
        if (this.hardMode) {
            document.getElementById('btn-incorrect-text').textContent = `Incorrecto -${Math.floor(pts / 2)}`;
        } else {
            document.getElementById('btn-incorrect-text').textContent = 'Incorrecto';
        }
    }

    updateTurnIndicatorModal() {
        const ind = document.getElementById('modal-turn-indicator');
        if (ind && this.players[this.currentPlayer]) {
            ind.textContent = `🎯 Turno: ${this.players[this.currentPlayer].name}`;
            ind.classList.remove('jump-animation');
            void ind.offsetWidth;
            ind.classList.add('jump-animation');
        }
    }

    showQuestionForPlayers(data) {
        document.getElementById('modal-category').textContent = `${data.category} — ${data.points} pts`;
        document.getElementById('modal-question').textContent = data.question;
        document.getElementById('modal-answer').classList.add('hidden');
        document.getElementById('answer-buttons').style.display = 'none';
        document.getElementById('manual-points').classList.add('hidden');
        const jumpBtn = document.getElementById('btn-jump'); if (jumpBtn) jumpBtn.classList.add('hidden');
        const closeBtn = document.querySelector('#question-modal .close'); if (closeBtn) closeBtn.style.display = 'none';
        document.getElementById('question-modal').classList.add('active');
    }

    closeModal() {
        if (!this.isHost) return;
        if (this.answerRevealed || !this.currentQuestion) {
            document.getElementById('question-modal').classList.remove('active');
            this.answerRevealed = false; this.currentQuestion = null; this.questionJumped = false;
            this.broadcast({ type: 'close-modal' });
            if (this.gameStarted && this.questions.every(q => q.used)) this.endGame();
        }
    }

    // ==================== SALTO DE PREGUNTA ====================
    jumpQuestion() {
        if (!this.isHost || !this.jumpEnabled || !this.currentQuestion || this.answerRevealed) return;
        
        this.playSound('jump');
        
        // Si modo difícil, restar puntos al jugador actual
        if (this.hardMode && !this.questionJumped) {
            const penalty = Math.floor(this.currentQuestion.points / 2);
            this.players[this.currentPlayer].score -= penalty;
            if (this.players[this.currentPlayer].score < 0) this.players[this.currentPlayer].score = 0;
        }
        
        // Buscar siguiente jugador (no host)
        let nextPlayer = this.currentPlayer;
        do { nextPlayer = (nextPlayer + 1) % this.players.length; }
        while (this.players[nextPlayer]?.isHost && this.players.length > 1);
        
        this.currentPlayer = nextPlayer;
        this.questionJumped = true;
        
        // Actualizar UI
        this.updateTurnIndicatorModal();
        this.updateButtonTexts();
        this.renderBoard();
        
        // Notificar
        this.broadcast({ type: 'jump-notification', playerName: this.players[this.currentPlayer].name, currentPlayer: this.currentPlayer, players: this.players });
    }

    showJumpNotification(data) {
        if (data.players) this.players = data.players;
        if (data.currentPlayer !== undefined) this.currentPlayer = data.currentPlayer;
        this.renderBoard();
        this.updateTurnIndicatorModal();
        document.getElementById('modal-turn-indicator').textContent = `🎯 Saltó a: ${data.playerName}`;
        document.getElementById('modal-turn-indicator').classList.remove('jump-animation');
        void document.getElementById('modal-turn-indicator').offsetWidth;
        document.getElementById('modal-turn-indicator').classList.add('jump-animation');
    }

    // ==================== RESPUESTAS ====================
    handleAnswer(correct) {
        if (!this.isHost || !this.currentQuestion || this.answerRevealed) return;
        this.answerRevealed = true;
        this.playSound(correct ? 'correct' : 'incorrect');
        
        if (correct) {
            this.players[this.currentPlayer].score += this.currentQuestion.points;
        } else if (this.hardMode) {
            const penalty = Math.floor(this.currentQuestion.points / 2);
            this.players[this.currentPlayer].score -= penalty;
            if (this.players[this.currentPlayer].score < 0) this.players[this.currentPlayer].score = 0;
        }
        
        const answerDiv = document.getElementById('modal-answer');
        answerDiv.classList.remove('hidden', 'correct-anim', 'incorrect-anim');
        answerDiv.classList.add(correct ? 'correct-anim' : 'incorrect-anim');
        document.getElementById('correct-answer-text').textContent = this.currentQuestion.answer;
        document.getElementById('answer-buttons').style.display = 'none';
        
        // Mostrar ajuste manual
        document.getElementById('manual-points').classList.remove('hidden');
        document.getElementById('manual-player-name').textContent = this.players[this.currentPlayer].name;
        
        const closeBtn = document.querySelector('#question-modal .close');
        if (closeBtn) closeBtn.style.display = 'flex';
        
        this.currentQuestion.used = true;
        
        this.broadcast({ type: 'answer-result', correct, answer: this.currentQuestion.answer, playerName: this.players[this.currentPlayer].name, pointsAwarded: correct ? this.currentQuestion.points : 0, players: this.players });
        
        // Siguiente turno
        do { this.currentPlayer = (this.currentPlayer + 1) % this.players.length; }
        while (this.players[this.currentPlayer]?.isHost && this.players.length > 1);
        
        this.broadcast({ type: 'game-update', questionId: this.currentQuestion.id, players: this.players, currentPlayer: this.currentPlayer });
        this.renderBoard(); this.saveState();
        if (this.questions.every(q => q.used)) setTimeout(() => this.endGame(), 1500);
    }

    showAnswerForPlayers(data) {
        const answerDiv = document.getElementById('modal-answer');
        answerDiv.classList.remove('hidden', 'correct-anim', 'incorrect-anim');
        answerDiv.classList.add(data.correct ? 'correct-anim' : 'incorrect-anim');
        document.getElementById('correct-answer-text').textContent = data.answer;
        document.getElementById('answer-buttons').style.display = 'none';
        document.getElementById('manual-points').classList.add('hidden');
        const closeBtn = document.querySelector('#question-modal .close'); if (closeBtn) closeBtn.style.display = 'none';
        if (data.players) this.players = data.players;
    }

    // ==================== AJUSTE MANUAL DE PUNTOS ====================
    adjustPoints(amount) {
        if (!this.isHost) return;
        const playerName = document.getElementById('manual-player-name').textContent;
        const player = this.players.find(p => p.name === playerName);
        if (player) {
            player.score += amount;
            if (player.score < 0) player.score = 0;
            this.renderBoard();
            this.broadcast({ type: 'game-update', players: this.players });
            this.saveState();
            this.showToast(`${player.name}: ${amount > 0 ? '+' + amount : amount} pts (Total: ${player.score})`);
        }
    }

    // ==================== FIN ====================
    endGame() {
        if (!this.isHost) return;
        this.gameStarted = false;
        document.getElementById('question-modal').classList.remove('active');
        this.broadcast({ type: 'game-end', players: this.players });
        this.stopGameMusic();
        this.playSound('win');
        this.showResults(); this.createConfetti(); this.clearState();
    }

    showResults() {
        const sorted = [...this.players].sort((a, b) => b.score - a.score);
        this.sortedPlayers = sorted;
        const podium = document.getElementById('podium'); if (!podium) return; podium.innerHTML = '';
        const top = sorted.slice(0, 3); const order = [];
        if (top.length >= 2) order.push({ p: top[1], pos: 2 });
        if (top.length >= 1) order.push({ p: top[0], pos: 1 });
        if (top.length >= 3) order.push({ p: top[2], pos: 3 });
        order.forEach(({ p, pos }) => {
            const card = document.createElement('div'); card.className = `result-card ${pos === 1 ? 'first' : pos === 2 ? 'second' : 'third'}`;
            const emoji = pos === 1 ? '🥇' : pos === 2 ? '🥈' : '🥉';
            card.innerHTML = `<div class="pos">${emoji} #${pos}</div><div class="name">${p.name}</div><div class="pts">${p.score} pts</div>`; podium.appendChild(card);
        });
        document.getElementById('full-results').classList.add('hidden'); this.showScreen('results-screen');
    }

    toggleFullResults() {
        const el = document.getElementById('full-results'); if (!el) return;
        if (el.classList.contains('hidden')) {
            el.innerHTML = '<h3>Clasificación Completa</h3>';
            this.sortedPlayers.forEach((p, i) => { const row = document.createElement('div'); row.className = 'result-row'; row.innerHTML = `<span class="rank">#${i + 1}</span><span class="name-col">${p.name}</span><span class="pts-col">${p.score} pts</span>`; el.appendChild(row); });
            el.classList.remove('hidden');
        } else el.classList.add('hidden');
    }

    createConfetti() {
        const container = document.getElementById('confetti'); if (!container) return; container.innerHTML = '';
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
        for (let i = 0; i < 80; i++) {
            const piece = document.createElement('div'); piece.className = 'confetti-piece'; piece.style.left = Math.random() * 100 + '%';
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDelay = Math.random() * 2 + 's'; piece.style.animationDuration = (2 + Math.random() * 3) + 's';
            piece.style.width = (6 + Math.random() * 8) + 'px'; piece.style.height = (6 + Math.random() * 8) + 'px'; container.appendChild(piece);
        }
        setTimeout(() => { container.innerHTML = ''; }, 5000);
    }

    disconnect() {
        if (this.peer) { this.peer.destroy(); this.peer = null; }
        this.clearState(); sessionStorage.removeItem('jeopardy-player-code'); sessionStorage.removeItem('jeopardy-player-name');
        this.stopGameMusic();
        this.categories = []; this.questions = []; this.players = []; this.connections = [];
        this.joinedNames = new Set(); this.currentPlayer = 0; this.gameStarted = false;
        this.currentQuestion = null; this.answerRevealed = false; this.isHost = false; this.roomCode = '';
        this.roomFromQR = null; this.jumpEnabled = false; this.hardMode = false; this.questionJumped = false;
        document.getElementById('question-modal').classList.remove('active');
        document.getElementById('answer-buttons').style.display = 'flex';
        document.getElementById('join-form').classList.add('hidden');
        document.getElementById('load-trivia-form').classList.add('hidden');
        document.querySelector('.home-actions').style.display = 'flex';
        document.querySelector('.trivia-actions').style.display = 'flex';
        const btn = document.getElementById('join-room-submit'); if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
        const codeInput = document.getElementById('room-code'); if (codeInput) { codeInput.disabled = false; codeInput.value = ''; }
        const triviaInput = document.getElementById('trivia-code-input'); if (triviaInput) triviaInput.value = '';
        const confetti = document.getElementById('confetti'); if (confetti) confetti.innerHTML = '';
        const closeBtn = document.querySelector('#question-modal .close'); if (closeBtn) closeBtn.style.display = 'flex';
        if (window.location.search) window.history.replaceState({}, '', window.location.pathname);
        this.showScreen('home-screen');
    }
}
