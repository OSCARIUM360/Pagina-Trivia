document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado, iniciando juego...');
    
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

        this.setupMusic();
        this.bindEvents();
        
        if (this.restoreState()) {
            console.log('Estado restaurado');
        } else if (roomFromQR) {
            this.showQRJoinScreen(roomFromQR);
        } else {
            this.showScreen('home-screen');
        }
        
        console.log('Juego inicializado');
    }

    // ==================== PERSISTENCIA ====================
    
    saveState() {
        const state = {
            categories: this.categories,
            questions: this.questions,
            players: this.players,
            currentPlayer: this.currentPlayer,
            totalCategories: this.totalCategories,
            questionsPerCategory: this.questionsPerCategory,
            gameStarted: this.gameStarted,
            isHost: this.isHost,
            roomCode: this.roomCode,
            currentScreen: this.getCurrentScreen()
        };
        localStorage.setItem('jeopardy-state', JSON.stringify(state));
    }

    restoreState() {
        const saved = localStorage.getItem('jeopardy-state');
        if (!saved) return false;
        
        try {
            const state = JSON.parse(saved);
            if (!state.isHost || !state.roomCode) return false;
            
            this.categories = state.categories || [];
            this.questions = state.questions || [];
            this.players = state.players || [];
            this.currentPlayer = state.currentPlayer || 0;
            this.totalCategories = state.totalCategories || 0;
            this.questionsPerCategory = state.questionsPerCategory || 0;
            this.gameStarted = state.gameStarted || false;
            this.isHost = state.isHost;
            this.roomCode = state.roomCode;
            this.joinedNames = new Set(this.players.map(p => p.name));
            
            this.initPeer(this.roomCode + '-host');
            
            if (state.currentScreen) {
                this.showScreen(state.currentScreen);
                if (state.currentScreen === 'lobby-screen') this.updateLobby();
                else if (state.currentScreen === 'game-screen') this.renderBoard();
                else if (state.currentScreen === 'categories-screen') this.showCategoriesScreen();
                else if (state.currentScreen === 'questions-screen') this.showQuestionsScreen();
            }
            return true;
        } catch (e) {
            console.error('Error restaurando estado:', e);
            return false;
        }
    }

    clearState() {
        localStorage.removeItem('jeopardy-state');
    }

    getCurrentScreen() {
        const active = document.querySelector('.screen.active');
        return active ? active.id : 'home-screen';
    }

    // ==================== QR JOIN ====================
    
    showQRJoinScreen(code) {
        this.roomCode = code;
        this.isHost = false;
        document.getElementById('join-form').classList.remove('hidden');
        document.getElementById('room-code').value = code;
        document.getElementById('room-code').disabled = true;
        document.getElementById('join-player-name').focus();
        document.querySelector('.home-actions').style.display = 'none';
        document.querySelector('.trivia-actions').style.display = 'none';
        this.showScreen('home-screen');
    }

    // ==================== MÚSICA Y SONIDOS ====================

    setupMusic() {
        this.bgMusic = document.getElementById('bg-music');
        if (this.bgMusic) this.bgMusic.volume = 0.15;
    }

    playSound(type) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (type === 'select') this._playTone(ctx, 660, 0.08, 'sine');
            else if (type === 'correct') {
                this._playTone(ctx, 523, 0.12, 'sine');
                setTimeout(() => { try { this._playTone(ctx, 659, 0.12, 'sine'); } catch(e) {} }, 100);
                setTimeout(() => { try { this._playTone(ctx, 784, 0.2, 'sine'); } catch(e) {} }, 200);
            } else if (type === 'incorrect') {
                this._playTone(ctx, 200, 0.3, 'sawtooth');
            } else if (type === 'win') {
                [523, 659, 784, 1047].forEach((f, i) => {
                    setTimeout(() => { try { this._playTone(ctx, f, 0.2, 'sine'); } catch(e) {} }, i * 150);
                });
            }
        } catch(e) {}
    }

    _playTone(ctx, freq, dur, type) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = type;
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + dur);
    }

    // ==================== EVENTOS ====================

    bindEvents() {
        // Home
        this.onClick('create-room-btn', () => this.createRoom());
        this.onClick('join-room-btn', () => {
            document.getElementById('join-form').classList.remove('hidden');
            document.getElementById('room-code').disabled = false;
            document.getElementById('room-code').value = '';
            document.querySelector('.home-actions').style.display = 'flex';
            document.querySelector('.trivia-actions').style.display = 'flex';
        });
        this.onClick('join-room-submit', () => this.joinRoom());
        this.onClick('cancel-join', () => {
            document.getElementById('join-form').classList.add('hidden');
            document.querySelector('.home-actions').style.display = 'flex';
            document.querySelector('.trivia-actions').style.display = 'flex';
            if (this.roomFromQR) window.location.href = window.location.pathname;
        });
        this.onClick('toggle-music', () => this.toggleMusic());
        
        // Trivia load
        this.onClick('load-trivia-btn', () => {
            console.log('Click en cargar trivia');
            document.getElementById('load-trivia-form').classList.remove('hidden');
        });
        this.onClick('load-trivia-submit', () => {
            console.log('Click en submit cargar trivia');
            this.importTrivia();
        });
        this.onClick('cancel-load-trivia', () => {
            console.log('Click en cancelar carga');
            document.getElementById('load-trivia-form').classList.add('hidden');
        });
        
        // Setup
        this.onClick('back-to-home', () => this.disconnect());
        this.onClick('create-board', () => this.createBoard());
        this.onClick('back-to-setup', () => { this.showScreen('setup-screen'); this.saveState(); });
        
        // Categories
        this.onClick('submit-categories', () => this.submitCategories());
        this.onClick('back-to-categories', () => { this.showCategoriesScreen(); this.saveState(); });
        
        // Questions
        this.onClick('submit-questions', () => this.submitQuestions());
        this.onClick('back-to-questions', () => { this.showScreen('questions-screen'); this.saveState(); });
        this.onClick('export-trivia', () => {
            console.log('Click en exportar trivia');
            this.exportTrivia();
        });
        
        // Lobby
        this.onClick('start-game-lobby', () => this.startGame());
        
        // Game
        this.onClick('end-game', () => this.endGame());
        
        // Modal
        this.onClick('btn-correct', () => this.handleAnswer(true));
        this.onClick('btn-incorrect', () => this.handleAnswer(false));
        const closeBtn = document.querySelector('#question-modal .close');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
        
        // Results
        this.onClick('show-full-results', () => this.toggleFullResults());
        this.onClick('new-game', () => this.disconnect());
        
        // Enter keys
        const roomInput = document.getElementById('room-code');
        const nameInput = document.getElementById('join-player-name');
        if (roomInput && nameInput) {
            roomInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') nameInput.focus(); });
            nameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.joinRoom(); });
        }
        
        window.addEventListener('beforeunload', () => {
            if (this.isHost && this.roomCode) this.saveState();
        });
    }

    onClick(id, handler) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
        else console.error('No encontrado:', id);
    }

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(id);
        if (screen) screen.classList.add('active');
        
        const hostControls = document.getElementById('host-controls');
        const lobbyActions = document.getElementById('lobby-host-actions');
        if (hostControls) hostControls.style.display = this.isHost ? 'flex' : 'none';
        if (lobbyActions) lobbyActions.style.display = this.isHost ? 'flex' : 'none';
        
        if (this.isHost) this.saveState();
    }

    toggleMusic() {
        const btn = document.getElementById('toggle-music');
        if (this.musicPlaying) {
            if (this.bgMusic) this.bgMusic.pause();
            if (btn) btn.innerHTML = '<i class="fas fa-music"></i>';
        } else {
            if (this.bgMusic) this.bgMusic.play().catch(() => {});
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

    // ==================== SALA Y CONEXIÓN ====================

    createRoom() {
        this.clearState();
        this.isHost = true;
        this.roomCode = this.generateRoomCode();
        this.players = [{ name: 'Host', score: 0, id: 'host', isHost: true }];
        this.joinedNames = new Set(['Host']);
        this.initPeer(this.roomCode + '-host');
        this.showScreen('setup-screen');
        this.saveState();
    }

    joinRoom() {
        const code = document.getElementById('room-code').value.trim().toUpperCase();
        const name = document.getElementById('join-player-name').value.trim();
        if (!name) return alert('Ingresa tu nombre');
        if (!code || code.length !== 6) return alert('El código debe tener 6 caracteres');

        const btn = document.getElementById('join-room-submit');
        btn.disabled = true;
        btn.textContent = 'Conectando...';

        this.roomCode = code;
        this.isHost = false;
        this.playerName = name;
        this.initPeer(code + '-player-' + Date.now());
    }

    initPeer(id) {
        if (this.peer) { this.peer.destroy(); this.peer = null; }
        
        this.peer = new Peer(id, {
            debug: 0,
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('open', (peerId) => {
            console.log('PeerJS abierto:', peerId);
            if (!this.isHost) {
                setTimeout(() => {
                    const conn = this.peer.connect(this.roomCode + '-host', {
                        reliable: true,
                        metadata: { name: this.playerName }
                    });
                    this.handleConnection(conn);
                }, 500);
            }
        });

        this.peer.on('connection', (conn) => this.handleConnection(conn));

        this.peer.on('error', (err) => {
            console.error('Error PeerJS:', err);
            if (!this.isHost) {
                alert('Error de conexión. Verifica el código.');
                const btn = document.getElementById('join-room-submit');
                if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
            }
        });
        
        this.peer.on('disconnected', () => {
            if (this.peer && !this.peer.destroyed) this.peer.reconnect();
        });
    }

    handleConnection(conn) {
        if (this.connections.find(c => c.peer === conn.peer)) { conn.close(); return; }
        this.connections.push(conn);

        conn.on('open', () => {
            if (this.isHost) {
                conn.send({
                    type: 'welcome',
                    players: this.players,
                    gameStarted: this.gameStarted,
                    categories: this.categories,
                    questions: this.questions,
                    totalCategories: this.totalCategories,
                    questionsPerCategory: this.questionsPerCategory,
                    currentPlayer: this.currentPlayer
                });
            } else {
                conn.send({ type: 'join-request', name: this.playerName });
            }
        });

        conn.on('data', (data) => this.handleData(conn, data));

        conn.on('close', () => {
            this.connections = this.connections.filter(c => c !== conn);
            if (this.isHost && conn.metadata?.name) {
                this.players = this.players.filter(p => p.name !== conn.metadata.name);
                this.joinedNames.delete(conn.metadata.name);
                this.broadcastPlayers();
                this.updateLobby();
                this.saveState();
            }
        });
    }

    handleData(conn, data) {
        if (!this.isHost) {
            switch (data.type) {
                case 'welcome':
                    this.players = data.players || [];
                    this.updateLobby();
                    if (data.gameStarted) { this.loadGameState(data); this.renderBoard(); this.showScreen('game-screen'); }
                    else this.showLobby();
                    const btn = document.getElementById('join-room-submit');
                    if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
                    if (window.location.search) window.history.replaceState({}, '', window.location.pathname);
                    break;
                case 'players-update': this.players = data.players; this.updateLobby(); break;
                case 'game-start': this.loadGameState(data); this.renderBoard(); this.showScreen('game-screen'); break;
                case 'game-update': this.applyGameUpdate(data); break;
                case 'question-selected': this.showQuestionForPlayers(data); break;
                case 'answer-result': this.showAnswerForPlayers(data); break;
                case 'close-modal': document.getElementById('question-modal').classList.remove('active'); break;
                case 'game-end':
                    this.players = data.players;
                    this.gameStarted = false;
                    document.getElementById('question-modal').classList.remove('active');
                    this.showResults();
                    this.playSound('win');
                    break;
                case 'error': alert(data.message); break;
            }
        } else {
            if (data.type === 'join-request') this.handleJoinRequest(conn, data);
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
        this.broadcastPlayers();
        this.updateLobby();
        this.saveState();
    }

    broadcast(data) {
        this.connections.forEach(c => { if (c.open) { try { c.send(data); } catch(e) {} } });
    }

    broadcastPlayers() { this.broadcast({ type: 'players-update', players: this.players }); }

    loadGameState(data) {
        this.categories = data.categories || [];
        this.questions = data.questions || [];
        this.players = data.players || [];
        this.totalCategories = data.totalCategories || 0;
        this.questionsPerCategory = data.questionsPerCategory || 0;
        this.currentPlayer = data.currentPlayer || 0;
        this.gameStarted = true;
    }

    applyGameUpdate(data) {
        if (data.questionId !== undefined) {
            const q = this.questions.find(q => q.id === data.questionId);
            if (q) q.used = true;
        }
        if (data.players) this.players = data.players;
        if (data.currentPlayer !== undefined) this.currentPlayer = data.currentPlayer;
        this.renderBoard();
    }

    // ==================== CONFIGURACIÓN (HOST) ====================

    createBoard() {
        if (!this.isHost) return;
        this.totalCategories = parseInt(document.getElementById('categories').value);
        this.questionsPerCategory = parseInt(document.getElementById('questions').value);
        if (this.totalCategories < 2 || this.totalCategories > 8 || this.questionsPerCategory < 1 || this.questionsPerCategory > 10)
            return alert('2-8 categorías, 1-10 preguntas');
        this.showCategoriesScreen();
        this.saveState();
    }

    showCategoriesScreen() {
        if (!this.isHost) return;
        const container = document.getElementById('category-inputs');
        container.innerHTML = '';
        for (let i = 0; i < this.totalCategories; i++) {
            const div = document.createElement('div');
            div.className = 'category-input';
            div.innerHTML = `<label>Categoría ${i + 1}</label><input type="text" class="category-name" placeholder="Ej: Ciencia" value="${this.categories[i] || ''}">`;
            container.appendChild(div);
        }
        this.showScreen('categories-screen');
    }

    submitCategories() {
        if (!this.isHost) return;
        const inputs = document.querySelectorAll('.category-name');
        this.categories = [];
        let valid = true;
        inputs.forEach((input, i) => {
            const name = input.value.trim();
            if (!name) { alert(`Nombre para Categoría ${i + 1}`); valid = false; }
            this.categories.push(name);
        });
        if (valid) { this.showQuestionsScreen(); this.saveState(); }
    }

    showQuestionsScreen() {
        if (!this.isHost) return;
        const container = document.getElementById('questions-container');
        container.innerHTML = '';
        
        // Preservar preguntas existentes
        const existingQuestions = [...this.questions];
        this.questions = [];
        let id = 0;
        
        this.categories.forEach(cat => {
            for (let i = 0; i < this.questionsPerCategory; i++) {
                const existing = existingQuestions.find(q => q.category === cat && q.points === (i + 1) * 100);
                const q = existing || { id, category: cat, points: (i + 1) * 100, question: '', answer: '', used: false };
                q.id = id;
                this.questions.push(q);
                
                const div = document.createElement('div');
                div.className = 'question-row';
                div.innerHTML = `
                    <h3>${cat} — ${q.points} pts</h3>
                    <div class="question-inputs">
                        <textarea class="q-input" placeholder="Pregunta" data-id="${id}">${q.question || ''}</textarea>
                        <textarea class="a-input" placeholder="Respuesta" data-id="${id}">${q.answer || ''}</textarea>
                    </div>`;
                container.appendChild(div);
                id++;
            }
        });
        this.showScreen('questions-screen');
    }

    submitQuestions() {
        if (!this.isHost) return;
        const qInputs = document.querySelectorAll('.q-input');
        const aInputs = document.querySelectorAll('.a-input');
        let valid = true;

        qInputs.forEach(input => {
            const id = parseInt(input.dataset.id);
            const q = this.questions.find(q => q.id === id);
            if (q) q.question = input.value.trim();
            if (!q || !q.question) { alert(`Falta pregunta`); valid = false; }
        });
        aInputs.forEach(input => {
            const id = parseInt(input.dataset.id);
            const q = this.questions.find(q => q.id === id);
            if (q) q.answer = input.value.trim();
            if (!q || !q.answer) { alert(`Falta respuesta`); valid = false; }
        });

        if (valid) { this.showLobby(); this.saveState(); }
    }

    // ==================== EXPORTAR / IMPORTAR ====================

    // ==================== EXPORTAR / IMPORTAR ====================

exportTrivia() {
    console.log('Exportando trivia...');
    
    if (!this.isHost) {
        console.log('No es host, no puede exportar');
        return;
    }
    
    // Obtener preguntas actuales de los campos de texto
    const qInputs = document.querySelectorAll('.q-input');
    const aInputs = document.querySelectorAll('.a-input');
    
    // Actualizar questions desde los inputs
    qInputs.forEach(input => {
        const id = parseInt(input.dataset.id);
        const q = this.questions.find(q => q.id === id);
        if (q) q.question = input.value.trim();
    });
    aInputs.forEach(input => {
        const id = parseInt(input.dataset.id);
        const q = this.questions.find(q => q.id === id);
        if (q) q.answer = input.value.trim();
    });
    
    if (this.questions.length === 0) {
        alert('Primero crea las preguntas antes de exportar');
        return;
    }
    
    // Verificar que todas las preguntas tengan datos
    const hasEmpty = this.questions.some(q => !q.question || !q.answer);
    if (hasEmpty) {
        alert('Completa todas las preguntas y respuestas antes de exportar');
        return;
    }
    
    // Crear objeto con los datos de la trivia
    const triviaData = {
        v: 1,
        c: this.categories,
        qpc: this.questionsPerCategory,
        q: this.questions.map(q => ({
            cat: q.category,
            pts: q.points,
            q: q.question,
            a: q.answer
        }))
    };
    
    // Convertir a JSON y Base64
    const jsonStr = JSON.stringify(triviaData);
    const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
    const code = 'JPTV' + base64;
    
    console.log('Código generado. Longitud:', code.length);
    
    // Copiar al portapapeles
    this.copyToClipboard(code);
    
    // Mostrar toast
    this.showToast('✅ ¡Código copiado! Ya puedes compartir esta trivia');
}

importTrivia() {
    console.log('Importando trivia...');
    
    const codeInput = document.getElementById('trivia-code-input');
    if (!codeInput) {
        console.error('No se encontró el textarea');
        return;
    }
    
    const code = codeInput.value.trim();
    console.log('Código ingresado:', code.substring(0, 10) + '...');
    
    if (!code) {
        alert('Pega el código de la trivia');
        return;
    }
    
    if (!code.startsWith('JPTV')) {
        alert('Código inválido. Debe comenzar con "JPTV"');
        return;
    }
    
    try {
        // Extraer Base64
        const base64 = code.substring(4);
        console.log('Base64 longitud:', base64.length);
        
        // Decodificar
        const jsonStr = decodeURIComponent(escape(atob(base64)));
        console.log('JSON longitud:', jsonStr.length);
        
        const data = JSON.parse(jsonStr);
        console.log('Datos parseados:', data);
        
        // Validar estructura (soporta formato antiguo y nuevo)
        let categories, questionsPerCategory, questions;
        
        if (data.categories && data.questions) {
            // Formato antiguo
            categories = data.categories;
            questionsPerCategory = data.questionsPerCategory;
            questions = data.questions.map(q => ({
                category: q.category,
                points: q.points,
                question: q.question,
                answer: q.answer
            }));
        } else if (data.c && data.q) {
            // Formato nuevo comprimido
            categories = data.c;
            questionsPerCategory = data.qpc;
            questions = data.q.map(q => ({
                category: q.cat,
                points: q.pts,
                question: q.q,
                answer: q.a
            }));
        } else {
            throw new Error('Formato no reconocido');
        }
        
        if (!categories || !questions || !questionsPerCategory) {
            throw new Error('Datos incompletos');
        }
        
        console.log('Categorías:', categories.length);
        console.log('Preguntas:', questions.length);
        
        // Cargar datos
        this.clearState();
        this.isHost = true;
        this.categories = categories;
        this.totalCategories = categories.length;
        this.questionsPerCategory = questionsPerCategory;
        
        // Reconstruir preguntas
        this.questions = questions.map((q, index) => ({
            id: index,
            category: q.category,
            points: q.points,
            question: q.question,
            answer: q.answer,
            used: false
        }));
        
        // Generar nuevo código de sala
        this.roomCode = this.generateRoomCode();
        this.players = [{ name: 'Host', score: 0, id: 'host', isHost: true }];
        this.joinedNames = new Set(['Host']);
        this.gameStarted = false;
        
        // Limpiar formulario
        document.getElementById('load-trivia-form').classList.add('hidden');
        codeInput.value = '';
        
        // Iniciar conexión
        this.initPeer(this.roomCode + '-host');
        
        // Ir al lobby
        this.showLobby();
        this.saveState();
        
        this.showToast('✅ ¡Trivia cargada! ' + this.totalCategories + ' categorías, ' + this.questions.length + ' preguntas');
        
    } catch (error) {
        console.error('Error al importar:', error);
        alert('Error al cargar la trivia. Asegúrate de que el código esté completo y no tenga espacios o saltos de línea.');
    }
}

copyToClipboard(text) {
    console.log('Copiando al portapapeles...');
    
    // Intentar método moderno
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('Copiado con Clipboard API');
        }).catch(err => {
            console.error('Error Clipboard API:', err);
            this.fallbackCopy(text);
        });
    } else {
        this.fallbackCopy(text);
    }
}

fallbackCopy(text) {
    console.log('Usando método fallback para copiar');
    
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    try {
        const success = document.execCommand('copy');
        console.log('Fallback copy:', success ? 'exitoso' : 'fallido');
        if (!success) {
            // Mostrar el código para copia manual
            prompt('Copia este código manualmente (Ctrl+C):', text);
        }
    } catch (err) {
        console.error('Error en fallback:', err);
        prompt('Copia este código manualmente (Ctrl+C):', text);
    }
    
    document.body.removeChild(textarea);
}

showToast(message) {
    console.log('Toast:', message);
    
    // Eliminar toast anterior
    const existing = document.querySelector('.export-toast');
    if (existing) existing.remove();
    
    // Crear nuevo toast
    const toast = document.createElement('div');
    toast.className = 'export-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Eliminar después de 3 segundos
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

    // ==================== LOBBY ====================

    showLobby() {
        document.getElementById('room-code-display').textContent = this.roomCode;
        setTimeout(() => this.generateQR(), 300);
        this.updateLobby();
        this.showScreen('lobby-screen');
        document.getElementById('lobby-status').textContent = this.isHost ? '' : '⏳ Esperando al host...';
        this.saveState();
    }

    generateQR() {
        const container = document.getElementById('qrcode');
        if (!container) return;
        container.innerHTML = '';
        const url = window.location.origin + window.location.pathname + '?room=' + this.roomCode;
        try {
            if (typeof QRCode !== 'undefined') {
                new QRCode(container, {
                    text: url,
                    width: 150,
                    height: 150,
                    colorDark: '#1e293b',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });
            }
        } catch(e) {
            container.innerHTML = '<p style="font-size:0.8rem;word-break:break-all;">' + url + '</p>';
        }
    }

    updateLobby() {
        const container = document.getElementById('lobby-players-list');
        if (!container) return;
        container.innerHTML = '';
        this.players.forEach(p => {
            const tag = document.createElement('div');
            tag.className = 'player-tag' + (p.isHost ? ' host' : '');
            tag.innerHTML = (p.isHost ? '👑 ' : '') + p.name;
            container.appendChild(tag);
        });
    }

    // ==================== JUEGO ====================

    startGame() {
        if (!this.isHost) return;
        if (this.players.length < 2) return alert('Mínimo 2 jugadores');

        this.gameStarted = true;
        this.currentPlayer = this.players.findIndex(p => !p.isHost);
        if (this.currentPlayer < 0) this.currentPlayer = 0;

        this.broadcast({
            type: 'game-start',
            categories: this.categories,
            questions: this.questions.map(q => ({ ...q, answer: '' })),
            players: this.players,
            totalCategories: this.totalCategories,
            questionsPerCategory: this.questionsPerCategory,
            currentPlayer: this.currentPlayer
        });

        this.renderBoard();
        this.showScreen('game-screen');
        this.saveState();
    }

    renderBoard() {
        const board = document.getElementById('game-board');
        if (!board) return;
        board.innerHTML = '';
        board.style.gridTemplateColumns = `repeat(${this.totalCategories + 1}, 1fr)`;

        const ph = document.createElement('div');
        ph.className = 'game-cell category';
        ph.textContent = 'Pts';
        board.appendChild(ph);

        this.categories.forEach(cat => {
            const h = document.createElement('div');
            h.className = 'game-cell category';
            h.textContent = cat;
            board.appendChild(h);
        });

        for (let i = 0; i < this.questionsPerCategory; i++) {
            const pc = document.createElement('div');
            pc.className = 'game-cell category';
            pc.textContent = (i + 1) * 100;
            board.appendChild(pc);

            this.categories.forEach(cat => {
                const q = this.questions.find(q => q.category === cat && q.points === (i + 1) * 100);
                const cell = document.createElement('div');
                cell.className = `game-cell ${q?.used ? 'used' : 'clickable'}`;
                cell.textContent = q?.used ? '✓' : (i + 1) * 100;
                if (!q?.used && this.isHost) cell.addEventListener('click', () => this.selectQuestion(q));
                board.appendChild(cell);
            });
        }

        this.renderPlayers();
        this.updateTurnIndicator();
    }

    renderPlayers() {
        const bar = document.getElementById('players-bar');
        if (!bar) return;
        bar.innerHTML = '';
        this.players.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = `player-score ${i === this.currentPlayer ? 'active' : ''}`;
            div.innerHTML = `<strong>${p.name}</strong><br>${p.score} pts`;
            if (this.isHost) {
                div.style.cursor = 'pointer';
                div.addEventListener('click', () => {
                    if (!document.getElementById('question-modal').classList.contains('active')) {
                        this.currentPlayer = i;
                        this.renderBoard();
                        this.broadcast({ type: 'game-update', currentPlayer: this.currentPlayer });
                        this.saveState();
                    }
                });
            }
            bar.appendChild(div);
        });
    }

    updateTurnIndicator() {
        const indicator = document.getElementById('turn-indicator');
        if (indicator && this.players[this.currentPlayer])
            indicator.textContent = `🎯 Turno de: ${this.players[this.currentPlayer].name}`;
    }

    selectQuestion(q) {
        if (!this.isHost || q.used || !this.gameStarted) return;
        this.playSound('select');
        this.currentQuestion = q;
        this.answerRevealed = false;

        document.getElementById('modal-category').textContent = `${q.category} — ${q.points} pts`;
        document.getElementById('modal-question').textContent = q.question;
        document.getElementById('modal-answer').classList.add('hidden');
        document.getElementById('answer-buttons').style.display = 'flex';
        
        const closeBtn = document.querySelector('#question-modal .close');
        if (closeBtn) closeBtn.style.display = 'flex';
        
        document.getElementById('question-modal').classList.add('active');
        this.broadcast({ type: 'question-selected', category: q.category, points: q.points, question: q.question });
    }

    showQuestionForPlayers(data) {
        document.getElementById('modal-category').textContent = `${data.category} — ${data.points} pts`;
        document.getElementById('modal-question').textContent = data.question;
        document.getElementById('modal-answer').classList.add('hidden');
        document.getElementById('answer-buttons').style.display = 'none';
        const closeBtn = document.querySelector('#question-modal .close');
        if (closeBtn) closeBtn.style.display = 'none';
        document.getElementById('question-modal').classList.add('active');
    }

    closeModal() {
        if (!this.isHost) return;
        if (this.answerRevealed || !this.currentQuestion) {
            document.getElementById('question-modal').classList.remove('active');
            this.answerRevealed = false;
            this.currentQuestion = null;
            this.broadcast({ type: 'close-modal' });
            if (this.gameStarted && this.questions.every(q => q.used)) this.endGame();
        }
    }

    handleAnswer(correct) {
        if (!this.isHost || !this.currentQuestion || this.answerRevealed) return;
        this.answerRevealed = true;
        this.playSound(correct ? 'correct' : 'incorrect');

        if (correct) this.players[this.currentPlayer].score += this.currentQuestion.points;

        const answerDiv = document.getElementById('modal-answer');
        answerDiv.classList.remove('hidden', 'correct-anim', 'incorrect-anim');
        answerDiv.classList.add(correct ? 'correct-anim' : 'incorrect-anim');
        document.getElementById('correct-answer-text').textContent = this.currentQuestion.answer;
        document.getElementById('answer-buttons').style.display = 'none';
        
        const closeBtn = document.querySelector('#question-modal .close');
        if (closeBtn) closeBtn.style.display = 'flex';

        this.broadcast({
            type: 'answer-result', correct,
            answer: this.currentQuestion.answer,
            playerName: this.players[this.currentPlayer].name,
            pointsAwarded: correct ? this.currentQuestion.points : 0,
            players: this.players
        });

        this.currentQuestion.used = true;
        do { this.currentPlayer = (this.currentPlayer + 1) % this.players.length; }
        while (this.players[this.currentPlayer]?.isHost && this.players.length > 1);

        this.broadcast({ type: 'game-update', questionId: this.currentQuestion.id, players: this.players, currentPlayer: this.currentPlayer });
        this.renderBoard();
        this.saveState();
        if (this.questions.every(q => q.used)) setTimeout(() => this.endGame(), 1500);
    }

    showAnswerForPlayers(data) {
        const answerDiv = document.getElementById('modal-answer');
        answerDiv.classList.remove('hidden', 'correct-anim', 'incorrect-anim');
        answerDiv.classList.add(data.correct ? 'correct-anim' : 'incorrect-anim');
        document.getElementById('correct-answer-text').textContent = data.answer;
        document.getElementById('answer-buttons').style.display = 'none';
        const closeBtn = document.querySelector('#question-modal .close');
        if (closeBtn) closeBtn.style.display = 'none';
        if (data.players) this.players = data.players;
    }

    endGame() {
        if (!this.isHost) return;
        this.gameStarted = false;
        document.getElementById('question-modal').classList.remove('active');
        this.broadcast({ type: 'game-end', players: this.players });
        this.playSound('win');
        this.showResults();
        this.createConfetti();
        this.clearState();
    }

    showResults() {
        const sorted = [...this.players].sort((a, b) => b.score - a.score);
        this.sortedPlayers = sorted;
        const podium = document.getElementById('podium');
        if (!podium) return;
        podium.innerHTML = '';

        const top = sorted.slice(0, 3);
        const order = [];
        if (top.length >= 2) order.push({ p: top[1], pos: 2 });
        if (top.length >= 1) order.push({ p: top[0], pos: 1 });
        if (top.length >= 3) order.push({ p: top[2], pos: 3 });

        order.forEach(({ p, pos }) => {
            const card = document.createElement('div');
            card.className = `result-card ${pos === 1 ? 'first' : pos === 2 ? 'second' : 'third'}`;
            const emoji = pos === 1 ? '🥇' : pos === 2 ? '🥈' : '🥉';
            card.innerHTML = `<div class="pos">${emoji} #${pos}</div><div class="name">${p.name}</div><div class="pts">${p.score} pts</div>`;
            podium.appendChild(card);
        });

        document.getElementById('full-results').classList.add('hidden');
        this.showScreen('results-screen');
    }

    toggleFullResults() {
        const el = document.getElementById('full-results');
        if (!el) return;
        if (el.classList.contains('hidden')) {
            el.innerHTML = '<h3>Clasificación Completa</h3>';
            this.sortedPlayers.forEach((p, i) => {
                const row = document.createElement('div');
                row.className = 'result-row';
                row.innerHTML = `<span class="rank">#${i + 1}</span><span class="name-col">${p.name}</span><span class="pts-col">${p.score} pts</span>`;
                el.appendChild(row);
            });
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }

    createConfetti() {
        const container = document.getElementById('confetti');
        if (!container) return;
        container.innerHTML = '';
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
        for (let i = 0; i < 80; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDelay = Math.random() * 2 + 's';
            piece.style.animationDuration = (2 + Math.random() * 3) + 's';
            piece.style.width = (6 + Math.random() * 8) + 'px';
            piece.style.height = (6 + Math.random() * 8) + 'px';
            container.appendChild(piece);
        }
        setTimeout(() => { container.innerHTML = ''; }, 5000);
    }

    disconnect() {
        if (this.peer) { this.peer.destroy(); this.peer = null; }
        this.clearState();
        
        this.categories = [];
        this.questions = [];
        this.players = [];
        this.connections = [];
        this.joinedNames = new Set();
        this.currentPlayer = 0;
        this.gameStarted = false;
        this.currentQuestion = null;
        this.answerRevealed = false;
        this.isHost = false;
        this.roomCode = '';
        this.roomFromQR = null;

        document.getElementById('question-modal').classList.remove('active');
        document.getElementById('answer-buttons').style.display = 'flex';
        document.getElementById('join-form').classList.add('hidden');
        document.getElementById('load-trivia-form').classList.add('hidden');
        document.querySelector('.home-actions').style.display = 'flex';
        document.querySelector('.trivia-actions').style.display = 'flex';
        
        const btn = document.getElementById('join-room-submit');
        if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
        const codeInput = document.getElementById('room-code');
        if (codeInput) { codeInput.disabled = false; codeInput.value = ''; }
        const triviaInput = document.getElementById('trivia-code-input');
        if (triviaInput) triviaInput.value = '';
        const confetti = document.getElementById('confetti');
        if (confetti) confetti.innerHTML = '';
        const closeBtn = document.querySelector('#question-modal .close');
        if (closeBtn) closeBtn.style.display = 'flex';

        if (window.location.search) window.history.replaceState({}, '', window.location.pathname);
        this.showScreen('home-screen');
    }
}
