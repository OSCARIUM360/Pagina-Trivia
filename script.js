document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado, iniciando juego...');
    
    // Verificar si hay parámetro room en la URL (viene del QR)
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
        
        // Restaurar estado si existe
        if (this.restoreState()) {
            console.log('Estado restaurado');
        } else if (roomFromQR) {
            // Viene de QR, mostrar pantalla de nombre
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
        console.log('Estado guardado:', state.currentScreen);
    }

    restoreState() {
        const saved = localStorage.getItem('jeopardy-state');
        if (!saved) return false;
        
        try {
            const state = JSON.parse(saved);
            
            // Solo restaurar si es el host y tiene un código de sala
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
            
            // Reconectar
            this.initPeer(this.roomCode + '-host');
            
            // Mostrar la pantalla correcta
            if (state.currentScreen) {
                this.showScreen(state.currentScreen);
                
                if (state.currentScreen === 'lobby-screen') {
                    this.updateLobby();
                } else if (state.currentScreen === 'game-screen') {
                    this.renderBoard();
                } else if (state.currentScreen === 'categories-screen') {
                    this.showCategoriesScreen();
                } else if (state.currentScreen === 'questions-screen') {
                    this.showQuestionsScreen();
                }
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
        const activeScreen = document.querySelector('.screen.active');
        return activeScreen ? activeScreen.id : 'home-screen';
    }

    // ==================== QR JOIN ====================
    
    showQRJoinScreen(code) {
        this.roomCode = code;
        this.isHost = false;
        
        // Mostrar formulario de nombre
        document.getElementById('join-form').classList.remove('hidden');
        document.getElementById('room-code').value = code;
        document.getElementById('room-code').disabled = true;
        document.getElementById('join-player-name').focus();
        
        // Ocultar botones de crear/unirse
        document.querySelector('.home-actions').style.display = 'none';
        
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
        console.log('Vinculando eventos...');
        
        // Home
        this.onClick('create-room-btn', () => this.createRoom());
        this.onClick('join-room-btn', () => {
            document.getElementById('join-form').classList.remove('hidden');
            document.getElementById('room-code').disabled = false;
            document.getElementById('room-code').value = '';
            document.querySelector('.home-actions').style.display = 'flex';
        });
        this.onClick('join-room-submit', () => this.joinRoom());
        this.onClick('cancel-join', () => {
            document.getElementById('join-form').classList.add('hidden');
            document.querySelector('.home-actions').style.display = 'flex';
            if (this.roomFromQR) {
                // Si venía de QR y cancela, recargar sin parámetro
                window.location.href = window.location.pathname;
            }
        });
        this.onClick('toggle-music', () => this.toggleMusic());
        
        // Setup
        this.onClick('back-to-home', () => this.disconnect());
        this.onClick('create-board', () => this.createBoard());
        this.onClick('back-to-setup', () => {
            this.showScreen('setup-screen');
            this.saveState();
        });
        
        // Categories
        this.onClick('submit-categories', () => this.submitCategories());
        this.onClick('back-to-categories', () => {
            this.showCategoriesScreen();
            this.saveState();
        });
        
        // Questions
        this.onClick('submit-questions', () => this.submitQuestions());
        this.onClick('back-to-questions', () => {
            this.showScreen('questions-screen');
            this.saveState();
        });
        
        // Lobby
        this.onClick('start-game-lobby', () => this.startGame());
        
        // Game
        this.onClick('end-game', () => this.endGame());
        
        // Modal
        this.onClick('btn-correct', () => this.handleAnswer(true));
        this.onClick('btn-incorrect', () => this.handleAnswer(false));
        
        const closeBtn = document.querySelector('#question-modal .close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }
        
        // Results
        this.onClick('show-full-results', () => this.toggleFullResults());
        this.onClick('new-game', () => this.disconnect());
        
        // Enter para unirse
        const roomInput = document.getElementById('room-code');
        const nameInput = document.getElementById('join-player-name');
        if (roomInput && nameInput) {
            roomInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') nameInput.focus();
            });
            nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.joinRoom();
            });
        }
        
        // Guardar estado antes de recargar
        window.addEventListener('beforeunload', () => {
            if (this.isHost && this.roomCode) {
                this.saveState();
            }
        });
        
        console.log('Eventos vinculados');
    }

    onClick(id, handler) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', handler);
            console.log('✓ Evento:', id);
        } else {
            console.error('✗ No encontrado:', id);
        }
    }

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(id);
        if (screen) screen.classList.add('active');
        
        const hostControls = document.getElementById('host-controls');
        const lobbyActions = document.getElementById('lobby-host-actions');
        if (hostControls) hostControls.style.display = this.isHost ? 'flex' : 'none';
        if (lobbyActions) lobbyActions.style.display = this.isHost ? 'flex' : 'none';
        
        // Guardar estado
        if (this.isHost) {
            this.saveState();
        }
    }

    toggleMusic() {
        if (this.musicPlaying) {
            if (this.bgMusic) this.bgMusic.pause();
            document.getElementById('toggle-music').innerHTML = '<i class="fas fa-music"></i>';
        } else {
            if (this.bgMusic) this.bgMusic.play().catch(() => {});
            document.getElementById('toggle-music').innerHTML = '<i class="fas fa-volume-up"></i>';
        }
        this.musicPlaying = !this.musicPlaying;
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // ==================== SALA Y CONEXIÓN ====================

    createRoom() {
        console.log('Creando sala...');
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
        const codeInput = document.getElementById('room-code');
        const nameInput = document.getElementById('join-player-name');
        
        const code = codeInput.value.trim().toUpperCase();
        const name = nameInput.value.trim();
        
        if (!name) return alert('Ingresa tu nombre');
        if (!code || code.length !== 6) return alert('El código debe tener 6 caracteres');

        const btn = document.getElementById('join-room-submit');
        btn.disabled = true;
        btn.textContent = 'Conectando...';

        this.roomCode = code;
        this.isHost = false;
        this.playerName = name;
        
        console.log('Intentando unirse a sala:', code, 'como:', name);
        this.initPeer(code + '-player-' + Date.now());
    }

    initPeer(id) {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        console.log('Iniciando PeerJS con ID:', id);
        
        // Crear Peer con opciones mejoradas
        const options = {
            debug: 1,
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' }
                ]
            }
        };
        
        this.peer = new Peer(id, options);

        this.peer.on('open', (peerId) => {
            console.log('✅ PeerJS abierto:', peerId);
            
            if (!this.isHost) {
                // Conectar al host
                const hostId = this.roomCode + '-host';
                console.log('Conectando al host:', hostId);
                
                setTimeout(() => {
                    try {
                        const conn = this.peer.connect(hostId, {
                            reliable: true,
                            metadata: { name: this.playerName }
                        });
                        this.handleConnection(conn);
                    } catch (err) {
                        console.error('Error al conectar:', err);
                        this.onConnectionError();
                    }
                }, 500);
            }
        });

        this.peer.on('connection', (conn) => {
            console.log('📞 Conexión entrante:', conn.peer);
            this.handleConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error('❌ Error PeerJS:', err);
            if (!this.isHost) {
                this.onConnectionError();
            }
        });
        
        this.peer.on('disconnected', () => {
            console.log('⚠️ Desconectado, reconectando...');
            if (this.peer && !this.peer.destroyed) {
                this.peer.reconnect();
            }
        });
    }

    onConnectionError() {
        alert('No se pudo conectar a la sala. Verifica:\n\n1. Que el código sea correcto\n2. Que el host tenga la sala abierta\n3. Que ambos tengan conexión a internet');
        const btn = document.getElementById('join-room-submit');
        if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
    }

    handleConnection(conn) {
        // Verificar duplicados
        if (this.connections.find(c => c.peer === conn.peer)) {
            console.log('Conexión duplicada, ignorando');
            conn.close();
            return;
        }
        
        this.connections.push(conn);
        console.log('Total conexiones:', this.connections.length);

        conn.on('open', () => {
            console.log('🔗 Conexión establecida con:', conn.peer);
            
            if (this.isHost) {
                console.log('Enviando welcome a:', conn.peer);
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
                console.log('Enviando join-request como:', this.playerName);
                conn.send({ type: 'join-request', name: this.playerName });
            }
        });

        conn.on('data', (data) => {
            console.log('📩 Datos recibidos:', data.type);
            this.handleData(conn, data);
        });

        conn.on('close', () => {
            console.log('Conexión cerrada:', conn.peer);
            this.connections = this.connections.filter(c => c !== conn);
            if (this.isHost && conn.metadata?.name) {
                this.players = this.players.filter(p => p.name !== conn.metadata.name);
                this.joinedNames.delete(conn.metadata.name);
                this.broadcastPlayers();
                this.updateLobby();
                this.saveState();
            }
        });
        
        conn.on('error', (err) => {
            console.error('Error en conexión:', err);
        });
    }

    handleData(conn, data) {
        if (!this.isHost) {
            switch (data.type) {
                case 'welcome':
                    console.log('🎉 Bienvenido a la sala!');
                    this.players = data.players || [];
                    this.updateLobby();
                    if (data.gameStarted) {
                        this.loadGameState(data);
                        this.renderBoard();
                        this.showScreen('game-screen');
                    } else {
                        this.showLobby();
                    }
                    const btn = document.getElementById('join-room-submit');
                    if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
                    // Limpiar parámetro QR de la URL
                    if (window.location.search) {
                        window.history.replaceState({}, '', window.location.pathname);
                    }
                    break;
                case 'players-update':
                    this.players = data.players;
                    this.updateLobby();
                    break;
                case 'game-start':
                    this.loadGameState(data);
                    this.renderBoard();
                    this.showScreen('game-screen');
                    break;
                case 'game-update':
                    this.applyGameUpdate(data);
                    break;
                case 'question-selected':
                    this.showQuestionForPlayers(data);
                    break;
                case 'answer-result':
                    this.showAnswerForPlayers(data);
                    break;
                case 'close-modal':
                    document.getElementById('question-modal').classList.remove('active');
                    break;
                case 'game-end':
                    this.players = data.players;
                    this.gameStarted = false;
                    document.getElementById('question-modal').classList.remove('active');
                    this.showResults();
                    this.playSound('win');
                    break;
                case 'error':
                    alert(data.message);
                    const btnErr = document.getElementById('join-room-submit');
                    if (btnErr) { btnErr.disabled = false; btnErr.textContent = 'Entrar'; }
                    break;
            }
        } else {
            if (data.type === 'join-request') {
                this.handleJoinRequest(conn, data);
            }
        }
    }

    handleJoinRequest(conn, data) {
        const name = data.name?.trim();
        console.log('Solicitud de unión:', name);
        
        if (!name) return;
        if (this.joinedNames.has(name)) {
            conn.send({ type: 'error', message: 'Nombre ya en uso' });
            return;
        }
        if (this.gameStarted) {
            conn.send({ type: 'error', message: 'Juego en curso' });
            return;
        }

        console.log('✅ Jugador aceptado:', name);
        this.players.push({ name, score: 0, id: conn.peer, isHost: false });
        this.joinedNames.add(name);
        conn.metadata = { name };
        conn.send({ type: 'join-accepted', players: this.players });
        this.broadcastPlayers();
        this.updateLobby();
        this.saveState();
    }

    broadcast(data) {
        console.log('Broadcast:', data.type, 'a', this.connections.length, 'conexiones');
        this.connections.forEach(c => { 
            if (c.open) { 
                try { c.send(data); } catch(e) {
                    console.error('Error broadcast:', e);
                }
            } 
        });
    }

    broadcastPlayers() {
        this.broadcast({ type: 'players-update', players: this.players });
    }

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
        if (this.totalCategories < 2 || this.totalCategories > 8 || this.questionsPerCategory < 1 || this.questionsPerCategory > 10) {
            return alert('2-8 categorías, 1-10 preguntas');
        }
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
        if (valid) {
            this.showQuestionsScreen();
            this.saveState();
        }
    }

    showQuestionsScreen() {
        if (!this.isHost) return;
        const container = document.getElementById('questions-container');
        container.innerHTML = '';
        this.questions = [];
        let id = 0;
        this.categories.forEach(cat => {
            for (let i = 0; i < this.questionsPerCategory; i++) {
                const existingQ = this.questions.find(q => q.category === cat && q.points === (i + 1) * 100);
                const q = existingQ || { id, category: cat, points: (i + 1) * 100, question: '', answer: '', used: false };
                if (!existingQ) {
                    q.id = id;
                    this.questions.push(q);
                }
                const div = document.createElement('div');
                div.className = 'question-row';
                div.innerHTML = `
                    <h3>${cat} — ${q.points} pts</h3>
                    <div class="question-inputs">
                        <textarea class="q-input" placeholder="Pregunta" data-id="${q.id}">${q.question}</textarea>
                        <textarea class="a-input" placeholder="Respuesta" data-id="${q.id}">${q.answer}</textarea>
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
            if (!q || !q.question) {
                alert(`Falta pregunta: ${q?.category || ''} ${q?.points || ''}pts`);
                valid = false;
            }
        });
        aInputs.forEach(input => {
            const id = parseInt(input.dataset.id);
            const q = this.questions.find(q => q.id === id);
            if (q) q.answer = input.value.trim();
            if (!q || !q.answer) {
                alert(`Falta respuesta: ${q?.category || ''} ${q?.points || ''}pts`);
                valid = false;
            }
        });

        if (valid) {
            this.showLobby();
            this.saveState();
        }
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
        // URL con parámetro room
        const url = window.location.origin + window.location.pathname + '?room=' + this.roomCode;
        console.log('QR URL:', url);
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

                if (!q?.used && this.isHost) {
                    cell.addEventListener('click', () => this.selectQuestion(q));
                }
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
        if (indicator && this.players[this.currentPlayer]) {
            indicator.textContent = `🎯 Turno de: ${this.players[this.currentPlayer].name}`;
        }
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

        this.broadcast({
            type: 'question-selected',
            category: q.category,
            points: q.points,
            question: q.question
        });
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
            
            if (this.gameStarted && this.questions.every(q => q.used)) {
                this.endGame();
            }
        }
    }

    handleAnswer(correct) {
        if (!this.isHost || !this.currentQuestion || this.answerRevealed) return;

        this.answerRevealed = true;
        this.playSound(correct ? 'correct' : 'incorrect');

        if (correct) {
            this.players[this.currentPlayer].score += this.currentQuestion.points;
        }

        const answerDiv = document.getElementById('modal-answer');
        answerDiv.classList.remove('hidden', 'correct-anim', 'incorrect-anim');
        answerDiv.classList.add(correct ? 'correct-anim' : 'incorrect-anim');
        document.getElementById('correct-answer-text').textContent = this.currentQuestion.answer;
        document.getElementById('answer-buttons').style.display = 'none';
        
        const closeBtn = document.querySelector('#question-modal .close');
        if (closeBtn) closeBtn.style.display = 'flex';

        this.broadcast({
            type: 'answer-result',
            correct,
            answer: this.currentQuestion.answer,
            playerName: this.players[this.currentPlayer].name,
            pointsAwarded: correct ? this.currentQuestion.points : 0,
            players: this.players
        });

        this.currentQuestion.used = true;

        do {
            this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
        } while (this.players[this.currentPlayer]?.isHost && this.players.length > 1);

        this.broadcast({
            type: 'game-update',
            questionId: this.currentQuestion.id,
            players: this.players,
            currentPlayer: this.currentPlayer
        });

        this.renderBoard();
        this.saveState();

        if (this.questions.every(q => q.used)) {
            setTimeout(() => this.endGame(), 1500);
        }
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
        document.querySelector('.home-actions').style.display = 'flex';
        
        const btn = document.getElementById('join-room-submit');
        if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
        
        const codeInput = document.getElementById('room-code');
        if (codeInput) { codeInput.disabled = false; codeInput.value = ''; }
        
        const confetti = document.getElementById('confetti');
        if (confetti) confetti.innerHTML = '';
        
        const closeBtn = document.querySelector('#question-modal .close');
        if (closeBtn) closeBtn.style.display = 'flex';

        // Limpiar parámetros de URL
        if (window.location.search) {
            window.history.replaceState({}, '', window.location.pathname);
        }

        this.showScreen('home-screen');
    }
}
