class JeopardyGame {
    constructor() {
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

        this.init();
    }

    init() {
        // Esperar a que el DOM esté completamente cargado
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        console.log('Inicializando Jeopardy Game...');
        this.bindEvents();
        this.showScreen('home-screen');
        this.setupMusic();
        
        // Intentar reproducir música con la primera interacción
        document.addEventListener('click', () => this.tryPlayMusic(), { once: true });
        
        console.log('Juego inicializado correctamente');
    }

    setupMusic() {
        this.bgMusic = document.getElementById('bg-music');
        if (this.bgMusic) {
            this.bgMusic.volume = 0.15;
            console.log('Música configurada');
        }
    }

    tryPlayMusic() {
        if (!this.musicPlaying && this.bgMusic) {
            this.bgMusic.play().catch((e) => console.log('No se pudo reproducir música:', e));
            this.musicPlaying = true;
        }
    }

    toggleMusic() {
        const btn = document.getElementById('toggle-music');
        if (!btn) return;
        
        if (this.musicPlaying) {
            if (this.bgMusic) this.bgMusic.pause();
            btn.innerHTML = '<i class="fas fa-music"></i>';
            this.musicPlaying = false;
        } else {
            if (this.bgMusic) this.bgMusic.play().catch(() => {});
            btn.innerHTML = '<i class="fas fa-volume-up"></i>';
            this.musicPlaying = true;
        }
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

    bindEvents() {
        console.log('Vinculando eventos...');
        
        // Home screen - Usar comprobación de existencia
        this.safeBind('create-room-btn', 'click', () => this.createRoom());
        this.safeBind('join-room-btn', 'click', () => {
            const form = document.getElementById('join-form');
            if (form) form.classList.remove('hidden');
        });
        this.safeBind('join-room-submit', 'click', () => this.joinRoom());
        this.safeBind('cancel-join', 'click', () => {
            const form = document.getElementById('join-form');
            if (form) form.classList.add('hidden');
        });
        
        // Setup
        this.safeBind('back-to-home', 'click', () => this.disconnect());
        this.safeBind('create-board', 'click', () => this.createBoard());
        this.safeBind('back-to-setup', 'click', () => this.showScreen('setup-screen'));
        
        // Categories
        this.safeBind('submit-categories', 'click', () => this.submitCategories());
        this.safeBind('back-to-categories', 'click', () => this.showCategoriesScreen());
        
        // Questions
        this.safeBind('submit-questions', 'click', () => this.submitQuestions());
        this.safeBind('back-to-questions', 'click', () => this.showScreen('questions-screen'));
        
        // Lobby
        this.safeBind('start-game-lobby', 'click', () => this.startGame());
        
        // Game
        this.safeBind('end-game', 'click', () => this.endGame());
        
        // Modal
        const closeBtn = document.querySelector('#question-modal .close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }
        this.safeBind('btn-correct', 'click', () => this.handleAnswer(true));
        this.safeBind('btn-incorrect', 'click', () => this.handleAnswer(false));
        
        // Results
        this.safeBind('show-full-results', 'click', () => this.toggleFullResults());
        this.safeBind('new-game', 'click', () => this.disconnect());
        
        // Music
        this.safeBind('toggle-music', 'click', () => this.toggleMusic());
        
        // Enter key para unirse
        const roomCodeInput = document.getElementById('room-code');
        const playerNameInput = document.getElementById('join-player-name');
        
        if (roomCodeInput) {
            roomCodeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && playerNameInput) playerNameInput.focus();
            });
        }
        if (playerNameInput) {
            playerNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.joinRoom();
            });
        }
        
        console.log('Eventos vinculados correctamente');
    }

    // Método seguro para vincular eventos
    safeBind(elementId, event, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(event, handler);
            console.log(`Evento vinculado: ${elementId} -> ${event}`);
        } else {
            console.warn(`Elemento no encontrado: ${elementId}`);
        }
    }

    showScreen(id) {
        console.log('Mostrando pantalla:', id);
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(id);
        if (screen) {
            screen.classList.add('active');
        } else {
            console.error('Pantalla no encontrada:', id);
        }
        this.updateUIForRole();
    }

    updateUIForRole() {
        const hostControls = document.getElementById('host-controls');
        const lobbyActions = document.getElementById('lobby-host-actions');
        if (hostControls) hostControls.style.display = this.isHost ? 'flex' : 'none';
        if (lobbyActions) lobbyActions.style.display = this.isHost ? 'flex' : 'none';
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        console.log('Código generado:', code);
        return code;
    }

    createRoom() {
        console.log('Creando sala...');
        this.isHost = true;
        this.roomCode = this.generateRoomCode();
        this.players = [{ name: 'Host', score: 0, id: 'host', isHost: true }];
        this.joinedNames = new Set(['Host']);
        
        const hostPeerId = this.roomCode + '-host';
        this.initPeer(hostPeerId);
        this.showScreen('setup-screen');
    }

    joinRoom() {
        console.log('Intentando unirse a sala...');
        
        const codeInput = document.getElementById('room-code');
        const nameInput = document.getElementById('join-player-name');
        
        if (!codeInput || !nameInput) {
            console.error('Inputs no encontrados');
            return;
        }
        
        const code = codeInput.value.trim().toUpperCase();
        const name = nameInput.value.trim();
        
        console.log('Código:', code, 'Nombre:', name);
        
        if (!name) {
            alert('Por favor, ingresa tu nombre');
            return;
        }
        
        if (!code || code.length !== 6) {
            alert('El código debe tener exactamente 6 caracteres');
            return;
        }
        
        const btn = document.getElementById('join-room-submit');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Conectando...';
        }

        this.roomCode = code;
        this.isHost = false;
        this.playerName = name;
        
        const playerPeerId = code + '-' + Date.now();
        this.initPeer(playerPeerId);
    }

    initPeer(id) {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        console.log('Iniciando PeerJS con ID:', id);
        
        try {
            this.peer = new Peer(id, {
                debug: 1,
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            this.peer.on('open', (peerId) => {
                console.log('✅ PeerJS conectado. Mi ID:', peerId);
                
                if (!this.isHost) {
                    const hostPeerId = this.roomCode + '-host';
                    console.log('Conectando al host:', hostPeerId);
                    const conn = this.peer.connect(hostPeerId, {
                        reliable: true,
                        metadata: { name: this.playerName }
                    });
                    this.handleConnection(conn);
                }
            });

            this.peer.on('connection', (conn) => {
                console.log('📞 Conexión entrante de:', conn.peer);
                this.handleConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('❌ Error PeerJS:', err);
                if (!this.isHost) {
                    alert('Error de conexión. Verifica el código e inténtalo de nuevo.');
                    const btn = document.getElementById('join-room-submit');
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Entrar';
                    }
                }
            });
            
            this.peer.on('disconnected', () => {
                console.log('⚠️ Peer desconectado');
                if (this.peer && !this.peer.destroyed) {
                    this.peer.reconnect();
                }
            });
        } catch (err) {
            console.error('Error al crear Peer:', err);
            alert('Error al inicializar la conexión. Recarga la página.');
        }
    }

    handleConnection(conn) {
        const existingConn = this.connections.find(c => c.peer === conn.peer);
        if (existingConn) {
            console.log('Conexión duplicada, cerrando');
            conn.close();
            return;
        }
        
        this.connections.push(conn);
        console.log('Total conexiones:', this.connections.length);

        conn.on('open', () => {
            console.log('🔗 Conexión abierta con:', conn.peer);
            
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
            }
        });
    }

    handleData(conn, data) {
        if (!this.isHost) {
            switch (data.type) {
                case 'welcome':
                    console.log('🎉 Bienvenido a la sala');
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
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Entrar';
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
                    this.closeModalForPlayers();
                    break;
                case 'game-end':
                    this.players = data.players;
                    this.gameStarted = false;
                    document.getElementById('question-modal').classList.remove('active');
                    this.showResults();
                    this.playSound('win');
                    break;
                case 'error':
                    alert('Error: ' + data.message);
                    const btnErr = document.getElementById('join-room-submit');
                    if (btnErr) {
                        btnErr.disabled = false;
                        btnErr.textContent = 'Entrar';
                    }
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
        if (!name) {
            conn.send({ type: 'error', message: 'Nombre inválido' });
            return;
        }
        if (this.joinedNames.has(name)) {
            conn.send({ type: 'error', message: 'Nombre ya en uso' });
            return;
        }
        if (this.gameStarted) {
            conn.send({ type: 'error', message: 'Juego en curso' });
            return;
        }

        console.log('✅ Jugador aceptado:', name);
        const player = { name, score: 0, id: conn.peer, isHost: false };
        this.players.push(player);
        this.joinedNames.add(name);
        conn.metadata = { name };
        conn.send({ type: 'join-accepted', players: this.players });
        this.broadcastPlayers();
        this.updateLobby();
    }

    broadcast(data) {
        this.connections.forEach(c => { 
            if (c.open) { 
                try { c.send(data); } catch(e) {} 
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

    createBoard() {
        if (!this.isHost) return;
        this.totalCategories = parseInt(document.getElementById('categories').value);
        this.questionsPerCategory = parseInt(document.getElementById('questions').value);
        if (this.totalCategories < 2 || this.totalCategories > 8 || this.questionsPerCategory < 1 || this.questionsPerCategory > 10) {
            return alert('2-8 categorías, 1-10 preguntas');
        }
        this.showCategoriesScreen();
    }

    showCategoriesScreen() {
        if (!this.isHost) return;
        const container = document.getElementById('category-inputs');
        container.innerHTML = '';
        for (let i = 0; i < this.totalCategories; i++) {
            const div = document.createElement('div');
            div.className = 'category-input';
            div.innerHTML = `<label>Categoría ${i + 1}</label><input type="text" class="category-name" placeholder="Ej: Ciencia">`;
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
        if (valid) this.showQuestionsScreen();
    }

    showQuestionsScreen() {
        if (!this.isHost) return;
        const container = document.getElementById('questions-container');
        container.innerHTML = '';
        this.questions = [];
        let id = 0;
        this.categories.forEach(cat => {
            for (let i = 0; i < this.questionsPerCategory; i++) {
                const q = { id, category: cat, points: (i + 1) * 100, question: '', answer: '', used: false };
                this.questions.push(q);
                const div = document.createElement('div');
                div.className = 'question-row';
                div.innerHTML = `
                    <h3>${cat} — ${q.points} pts</h3>
                    <div class="question-inputs">
                        <textarea class="q-input" placeholder="Escribe la pregunta" data-id="${id}"></textarea>
                        <textarea class="a-input" placeholder="Escribe la respuesta correcta" data-id="${id}"></textarea>
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
            this.questions[id].question = input.value.trim();
            if (!this.questions[id].question) {
                alert(`Falta pregunta: ${this.questions[id].category} ${this.questions[id].points}pts`);
                valid = false;
            }
        });
        aInputs.forEach(input => {
            const id = parseInt(input.dataset.id);
            this.questions[id].answer = input.value.trim();
            if (!this.questions[id].answer) {
                alert(`Falta respuesta: ${this.questions[id].category} ${this.questions[id].points}pts`);
                valid = false;
            }
        });

        if (valid) this.showLobby();
    }

    showLobby() {
        document.getElementById('room-code-display').textContent = this.roomCode;
        setTimeout(() => this.generateQR(), 300);
        this.updateLobby();
        this.showScreen('lobby-screen');

        const statusEl = document.getElementById('lobby-status');
        if (statusEl) {
            statusEl.textContent = this.isHost ? '' : '⏳ Esperando al host...';
        }
    }

    generateQR() {
        const container = document.getElementById('qrcode');
        if (!container) return;
        container.innerHTML = '';
        
        const baseUrl = window.location.origin + window.location.pathname;
        const url = `${baseUrl}?room=${this.roomCode}`;
        
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
            } else {
                container.innerHTML = `<p style="font-size:0.8rem;word-break:break-all;color:#6366f1;">${url}</p>`;
            }
        } catch (error) {
            container.innerHTML = `<p style="font-size:0.8rem;word-break:break-all;color:#6366f1;">${url}</p>`;
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
        
        // Mostrar X solo para el host
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
        
        // Ocultar X para jugadores
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
            
            // Notificar a jugadores que cierren
            this.broadcast({ type: 'close-modal' });
            
            if (this.gameStarted && this.questions.every(q => q.used)) {
                this.endGame();
            }
        }
    }

    closeModalForPlayers() {
        document.getElementById('question-modal').classList.remove('active');
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
        
        // Mantener X visible para el host
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
        
        // Mantener X oculta para jugadores
        const closeBtn = document.querySelector('#question-modal .close');
        if (closeBtn) closeBtn.style.display = 'none';
        
        if (data.players) this.players = data.players;
    }

    endGame() {
        if (!this.isHost && !this.gameStarted) return;
        this.gameStarted = false;
        document.getElementById('question-modal').classList.remove('active');
        this.broadcast({ type: 'game-end', players: this.players });
        this.playSound('win');
        this.showResults();
        this.createConfetti();
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

        const fullResults = document.getElementById('full-results');
        if (fullResults) fullResults.classList.add('hidden');
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

        const modal = document.getElementById('question-modal');
        if (modal) modal.classList.remove('active');
        const answerBtns = document.getElementById('answer-buttons');
        if (answerBtns) answerBtns.style.display = 'flex';
        const joinForm = document.getElementById('join-form');
        if (joinForm) joinForm.classList.add('hidden');
        const btn = document.getElementById('join-room-submit');
        if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
        const confetti = document.getElementById('confetti');
        if (confetti) confetti.innerHTML = '';
        
        // Restaurar X del modal
        const closeBtn = document.querySelector('#question-modal .close');
        if (closeBtn) closeBtn.style.display = 'flex';

        this.showScreen('home-screen');
    }
}

// Inicializar el juego cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM cargado, creando juego...');
    window.game = new JeopardyGame();
});
