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
        this.sounds = {};
        
        this.initSounds();
        this.init();
    }

    initSounds() {
        // Crear sonidos sintéticos
        this.sounds.select = () => this.playTone(800, 0.1);
        this.sounds.correct = () => {
            this.playTone(523, 0.1);
            setTimeout(() => this.playTone(659, 0.1), 100);
            setTimeout(() => this.playTone(784, 0.2), 200);
        };
        this.sounds.incorrect = () => {
            this.playTone(300, 0.2);
            setTimeout(() => this.playTone(200, 0.3), 200);
        };
    }

    playTone(frequency, duration) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;
            
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
            oscillator.stop(audioContext.currentTime + duration);
        } catch (e) {
            console.log('Audio no disponible');
        }
    }

    init() {
        this.bindEvents();
        this.showScreen('home-screen');
    }

    bindEvents() {
        // Home screen
        document.getElementById('create-room-btn').addEventListener('click', () => this.createRoom());
        document.getElementById('join-room-btn').addEventListener('click', () => this.showJoinForm());
        document.getElementById('join-room-submit').addEventListener('click', () => this.joinRoom());
        document.getElementById('cancel-join').addEventListener('click', () => this.hideJoinForm());
        
        // Setup screen
        document.getElementById('back-to-home').addEventListener('click', () => this.backToHome());
        document.getElementById('create-board').addEventListener('click', () => this.createBoard());
        
        // Categories screen
        document.getElementById('back-to-setup').addEventListener('click', () => this.backToSetup());
        document.getElementById('submit-categories').addEventListener('click', () => this.submitCategories());
        
        // Questions screen
        document.getElementById('back-to-categories').addEventListener('click', () => this.backToCategories());
        document.getElementById('submit-questions').addEventListener('click', () => this.submitQuestions());
        
        // Lobby screen
        document.getElementById('back-to-questions').addEventListener('click', () => this.backToQuestions());
        document.getElementById('start-game-lobby').addEventListener('click', () => this.startGame());
        
        // Game screen
        document.getElementById('end-game').addEventListener('click', () => this.endGame());
        
        // Modal events
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        document.getElementById('btn-correct').addEventListener('click', () => this.handleAnswer(true));
        document.getElementById('btn-incorrect').addEventListener('click', () => this.handleAnswer(false));
        
        // Results events
        document.getElementById('show-full-results').addEventListener('click', () => this.toggleFullResults());
        document.getElementById('new-game').addEventListener('click', () => this.newGame());
        
        // Add player on Enter
        document.getElementById('join-player-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    createRoom() {
        this.isHost = true;
        this.roomCode = this.generateRoomCode();
        this.showScreen('setup-screen');
    }

    showJoinForm() {
        document.getElementById('join-room-form').classList.remove('hidden');
    }

    hideJoinForm() {
        document.getElementById('join-room-form').classList.add('hidden');
    }

    generateRoomCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    joinRoom() {
        const code = document.getElementById('room-code').value.trim();
        const name = document.getElementById('join-player-name').value.trim();
        
        if (!code) {
            alert('Por favor, ingresa el código de sala');
            return;
        }
        
        if (!name) {
            alert('Por favor, ingresa tu nombre');
            return;
        }
        
        // Simular unirse a la sala
        this.roomCode = code;
        this.isHost = false;
        this.players.push({
            name: name,
            score: 0
        });
        
        alert(`¡Te has unido a la sala ${code}!\nEsperando a que el host inicie el juego...`);
    }

    backToHome() {
        this.showScreen('home-screen');
    }

    backToSetup() {
        this.showScreen('setup-screen');
    }

    backToCategories() {
        this.showCategoriesScreen();
    }

    backToQuestions() {
        this.showScreen('questions-screen');
    }

    createBoard() {
        this.totalCategories = parseInt(document.getElementById('categories').value);
        this.questionsPerCategory = parseInt(document.getElementById('questions').value);
        
        if (this.totalCategories < 2 || this.totalCategories > 8 || 
            this.questionsPerCategory < 2 || this.questionsPerCategory > 10) {
            alert('Por favor, elige entre 2-8 categorías y 2-10 preguntas por categoría');
            return;
        }
        
        this.showCategoriesScreen();
    }

    showCategoriesScreen() {
        const container = document.getElementById('category-inputs');
        container.innerHTML = '';
        
        for (let i = 0; i < this.totalCategories; i++) {
            const div = document.createElement('div');
            div.className = 'category-input';
            div.innerHTML = `
                <label>Categoría ${i + 1}:</label>
                <input type="text" class="category-name" placeholder="Nombre de la categoría" required>
            `;
            container.appendChild(div);
        }
        
        this.showScreen('categories-screen');
    }

    submitCategories() {
        const inputs = document.querySelectorAll('.category-name');
        this.categories = [];
        let allValid = true;
        
        inputs.forEach((input, index) => {
            const name = input.value.trim();
            if (!name) {
                alert(`Por favor, ingresa un nombre para la Categoría ${index + 1}`);
                allValid = false;
            }
            this.categories.push(name);
        });
        
        if (allValid && this.categories.length === this.totalCategories) {
            this.showQuestionsScreen();
        }
    }

    showQuestionsScreen() {
        const container = document.getElementById('questions-container');
        container.innerHTML = '';
        
        this.questions = [];
        let questionIndex = 0;
        
        this.categories.forEach((category, catIndex) => {
            for (let i = 0; i < this.questionsPerCategory; i++) {
                const questionObj = {
                    id: questionIndex,
                    category: category,
                    categoryIndex: catIndex,
                    points: (i + 1) * 100,
                    question: '',
                    answer: '',
                    used: false
                };
                
                this.questions.push(questionObj);
                
                const div = document.createElement('div');
                div.className = 'question-row';
                div.setAttribute('data-question-id', questionIndex);
                div.innerHTML = `
                    <h3>${category} - ${(i + 1) * 100} pts</h3>
                    <div class="question-inputs">
                        <textarea class="question-input" placeholder="Escribe la pregunta aquí" data-id="${questionIndex}"></textarea>
                        <textarea class="answer-input" placeholder="Escribe la respuesta aquí" data-id="${questionIndex}"></textarea>
                    </div>
                `;
                container.appendChild(div);
                
                questionIndex++;
            }
        });
        
        this.showScreen('questions-screen');
    }

    submitQuestions() {
        const questionInputs = document.querySelectorAll('.question-input');
        const answerInputs = document.querySelectorAll('.answer-input');
        let allComplete = true;
        
        questionInputs.forEach((input) => {
            const questionId = parseInt(input.getAttribute('data-id'));
            this.questions[questionId].question = input.value.trim();
            
            if (!this.questions[questionId].question) {
                allComplete = false;
                const category = this.questions[questionId].category;
                const points = this.questions[questionId].points;
                alert(`Por favor, completa la pregunta de ${category} - ${points} pts`);
                return;
            }
        });
        
        answerInputs.forEach((input) => {
            const questionId = parseInt(input.getAttribute('data-id'));
            this.questions[questionId].answer = input.value.trim();
            
            if (!this.questions[questionId].answer) {
                allComplete = false;
                const category = this.questions[questionId].category;
                const points = this.questions[questionId].points;
                alert(`Por favor, completa la respuesta de ${category} - ${points} pts`);
                return;
            }
        });
        
        if (allComplete) {
            this.showLobby();
        }
    }

    showLobby() {
        document.getElementById('room-code-display').textContent = this.roomCode;
        
        // Simular que el host se agrega a sí mismo
        if (this.isHost && this.players.length === 0) {
            this.players.push({
                name: 'Host',
                score: 0
            });
        }
        
        this.updateLobbyPlayersList();
        this.showScreen('lobby-screen');
    }

    updateLobbyPlayersList() {
        const container = document.getElementById('lobby-players-list');
        container.innerHTML = '';
        
        this.players.forEach((player) => {
            const tag = document.createElement('div');
            tag.className = 'player-tag';
            tag.innerHTML = `${player.name}`;
            container.appendChild(tag);
        });
    }

    startGame() {
        if (this.players.length < 2) {
            alert('Se necesitan al menos 2 jugadores para comenzar');
            return;
        }
        
        this.gameStarted = true;
        this.currentPlayer = 0;
        this.renderGameBoard();
        this.showScreen('game-screen');
    }

    renderGameBoard() {
        const board = document.getElementById('game-board');
        board.innerHTML = '';
        
        // Configurar grid
        board.style.gridTemplateColumns = `repeat(${this.totalCategories + 1}, 1fr)`;
        
        // Encabezado de categorías
        const pointsHeader = document.createElement('div');
        pointsHeader.className = 'game-cell category';
        pointsHeader.textContent = 'Puntos';
        board.appendChild(pointsHeader);
        
        this.categories.forEach(category => {
            const header = document.createElement('div');
            header.className = 'game-cell category';
            header.textContent = category;
            board.appendChild(header);
        });
        
        // Filas de preguntas
        for (let i = 0; i < this.questionsPerCategory; i++) {
            const pointsCell = document.createElement('div');
            pointsCell.className = 'game-cell';
            pointsCell.textContent = `${(i + 1) * 100}`;
            pointsCell.style.background = '#ba68c8';
            pointsCell.style.color = 'white';
            pointsCell.style.cursor = 'default';
            board.appendChild(pointsCell);
            
            this.categories.forEach((category) => {
                const question = this.questions.find(q => 
                    q.category === category && q.points === (i + 1) * 100
                );
                
                const cell = document.createElement('div');
                cell.className = `game-cell ${question.used ? 'used' : ''}`;
                
                if (question.used) {
                    cell.textContent = '✓';
                } else {
                    cell.textContent = `${(i + 1) * 100}`;
                    cell.addEventListener('click', () => this.selectQuestion(question));
                }
                
                board.appendChild(cell);
            });
        }
        
        this.renderPlayersBar();
    }

    renderPlayersBar() {
        const bar = document.getElementById('players-bar');
        bar.innerHTML = '';
        
        this.players.forEach((player, index) => {
            const div = document.createElement('div');
            div.className = `player-score ${index === this.currentPlayer ? 'active' : ''}`;
            div.innerHTML = `
                <strong>${player.name}</strong>
                <br>
                <span>${player.score} pts</span>
            `;
            
            div.addEventListener('click', () => {
                if (!document.getElementById('question-modal').classList.contains('active')) {
                    this.currentPlayer = index;
                    this.renderPlayersBar();
                }
            });
            
            bar.appendChild(div);
        });
    }

    selectQuestion(question) {
        if (question.used || !this.gameStarted) return;
        
        this.sounds.select();
        
        this.currentQuestion = question;
        this.answerRevealed = false;
        
        document.getElementById('modal-category').textContent = 
            `${question.category} - ${question.points} pts`;
        document.getElementById('modal-question').textContent = question.question;
        document.getElementById('modal-answer').classList.add('hidden');
        document.getElementById('answer-buttons').style.display = 'flex';
        
        document.getElementById('question-modal').classList.add('active');
    }

    closeModal() {
        if (this.answerRevealed || !this.currentQuestion) {
            document.getElementById('question-modal').classList.remove('active');
            this.answerRevealed = false;
            this.currentQuestion = null;
            
            if (this.gameStarted && this.questions.every(q => q.used)) {
                this.endGame();
            }
        }
    }

    handleAnswer(correct) {
        if (!this.currentQuestion || this.answerRevealed) return;
        
        this.answerRevealed = true;
        
        // Reproducir sonido
        if (correct) {
            this.sounds.correct();
        } else {
            this.sounds.incorrect();
        }
        
        // Mostrar respuesta
        document.getElementById('correct-answer-text').textContent = this.currentQuestion.answer;
        document.getElementById('modal-answer').classList.remove('hidden');
        
        // Ocultar botones de respuesta
        document.getElementById('answer-buttons').style.display = 'none';
        
        if (correct) {
            this.players[this.currentPlayer].score += this.currentQuestion.points;
        }
        
        // Marcar pregunta como usada
        this.currentQuestion.used = true;
        
        // Pasar al siguiente jugador
        this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
        
        // Actualizar UI
        this.renderGameBoard();
    }

    endGame() {
        this.gameStarted = false;
        document.getElementById('question-modal').classList.remove('active');
        this.showResults();
    }

    showResults() {
        const sortedPlayers = [...this.players].sort((a, b) => b.score - a.score);
        
        const topThree = document.getElementById('top-three');
        topThree.innerHTML = '';
        
        const topPlayers = sortedPlayers.slice(0, Math.min(3, sortedPlayers.length));
        
        const podiumOrder = [];
        if (topPlayers.length >= 2) podiumOrder.push({player: topPlayers[1], position: 2});
        if (topPlayers.length >= 1) podiumOrder.push({player: topPlayers[0], position: 1});
        if (topPlayers.length >= 3) podiumOrder.push({player: topPlayers[2], position: 3});
        
        podiumOrder.forEach(({player, position}) => {
            const positionClass = position === 1 ? 'first' : position === 2 ? 'second' : 'third';
            const card = document.createElement('div');
            card.className = `result-card ${positionClass}`;
            card.innerHTML = `
                <div class="position">#${position}</div>
                <div class="name">${player.name}</div>
                <div class="points">${player.score} pts</div>
            `;
            topThree.appendChild(card);
        });
        
        this.sortedPlayers = sortedPlayers;
        document.getElementById('full-results').classList.add('hidden');
        
        this.showScreen('results-screen');
    }

    toggleFullResults() {
        const fullResults = document.getElementById('full-results');
        
        if (fullResults.classList.contains('hidden')) {
            fullResults.innerHTML = '<h3>Resultados Completos</h3>';
            
            this.sortedPlayers.forEach((player, index) => {
                const row = document.createElement('div');
                row.className = 'result-row';
                row.innerHTML = `
                    <span>#${index + 1} ${player.name}</span>
                    <span>${player.score} pts</span>
                `;
                fullResults.appendChild(row);
            });
            
            fullResults.classList.remove('hidden');
            document.getElementById('show-full-results').textContent = 'Ocultar Resultados';
        } else {
            fullResults.classList.add('hidden');
            document.getElementById('show-full-results').textContent = 'Ver Resultados Completos';
        }
    }

    newGame() {
        this.categories = [];
        this.questions = [];
        this.players = [];
        this.currentPlayer = 0;
        this.gameStarted = false;
        this.currentQuestion = null;
        this.answerRevealed = false;
        
        document.getElementById('question-modal').classList.remove('active');
        document.getElementById('answer-buttons').style.display = 'flex';
        
        this.showScreen('home-screen');
    }
}

// Inicializar el juego cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
    window.game = new JeopardyGame();
});
