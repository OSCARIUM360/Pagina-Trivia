// ==================== REEMPLAZA la función closeModal ====================

closeModal() {
    if (!this.isHost) return; // Solo el host puede cerrar
    
    if (this.answerRevealed || !this.currentQuestion) {
        // Cerrar modal local
        document.getElementById('question-modal').classList.remove('active');
        this.answerRevealed = false;
        this.currentQuestion = null;
        
        // NOTIFICAR A LOS JUGADORES que cierren su modal
        this.broadcast({
            type: 'close-modal'
        });
        
        // Verificar fin del juego
        if (this.gameStarted && this.questions.every(q => q.used)) {
            this.endGame();
        }
    }
}

// ==================== AGREGA esta nueva función ====================

closeModalForPlayers() {
    // Los jugadores cierran el modal cuando el host lo ordena
    document.getElementById('question-modal').classList.remove('active');
}

// ==================== REEMPLAZA la función showQuestionForPlayers ====================

showQuestionForPlayers(data) {
    document.getElementById('modal-category').textContent = `${data.category} — ${data.points} pts`;
    document.getElementById('modal-question').textContent = data.question;
    document.getElementById('modal-answer').classList.add('hidden');
    document.getElementById('answer-buttons').style.display = 'none';
    
    // OCULTAR la X para los jugadores
    const closeBtn = document.querySelector('#question-modal .close');
    if (closeBtn) {
        closeBtn.style.display = 'none';
    }
    
    document.getElementById('question-modal').classList.add('active');
}

// ==================== REEMPLAZA la función showAnswerForPlayers ====================

showAnswerForPlayers(data) {
    const answerDiv = document.getElementById('modal-answer');
    answerDiv.classList.remove('hidden', 'correct-anim', 'incorrect-anim');
    answerDiv.classList.add(data.correct ? 'correct-anim' : 'incorrect-anim');
    document.getElementById('correct-answer-text').textContent = data.answer;
    document.getElementById('answer-buttons').style.display = 'none';
    if (data.players) this.players = data.players;
    
    // Asegurarse de que la X siga oculta
    const closeBtn = document.querySelector('#question-modal .close');
    if (closeBtn) {
        closeBtn.style.display = 'none';
    }
}

// ==================== REEMPLAZA la función selectQuestion (del host) ====================

selectQuestion(q) {
    if (!this.isHost || q.used || !this.gameStarted) return;
    this.playSound('select');
    this.currentQuestion = q;
    this.answerRevealed = false;

    document.getElementById('modal-category').textContent = `${q.category} — ${q.points} pts`;
    document.getElementById('modal-question').textContent = q.question;
    document.getElementById('modal-answer').classList.add('hidden');
    document.getElementById('answer-buttons').style.display = 'flex';
    
    // MOSTRAR la X para el host
    const closeBtn = document.querySelector('#question-modal .close');
    if (closeBtn) {
        closeBtn.style.display = 'flex';
    }
    
    document.getElementById('question-modal').classList.add('active');

    this.broadcast({
        type: 'question-selected',
        category: q.category,
        points: q.points,
        question: q.question
    });
}

// ==================== REEMPLAZA la función handleAnswer ====================

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
    
    // Mantener la X visible para el host
    const closeBtn = document.querySelector('#question-modal .close');
    if (closeBtn) {
        closeBtn.style.display = 'flex';
    }

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

// ==================== AGREGA 'close-modal' en handleData (parte del jugador) ====================

// Busca la función handleData y dentro del bloque "if (!this.isHost)" agrega este case:
// (Busca los otros case y agrega este nuevo)

handleData(conn, data) {
    console.log('Procesando datos. Soy host:', this.isHost, 'Tipo:', data.type);
    
    if (!this.isHost) {
        // SOY JUGADOR
        switch (data.type) {
            case 'welcome':
                // ... código existente ...
                break;
            case 'players-update':
                // ... código existente ...
                break;
            case 'game-start':
                // ... código existente ...
                break;
            case 'game-update':
                // ... código existente ...
                break;
            case 'question-selected':
                this.showQuestionForPlayers(data);
                break;
            case 'answer-result':
                this.showAnswerForPlayers(data);
                break;
            case 'close-modal':                    // <--- AGREGA ESTE CASE
                this.closeModalForPlayers();
                break;
            case 'game-end':
                // ... código existente ...
                break;
            case 'error':
                // ... código existente ...
                break;
        }
    } else {
        // SOY HOST
        if (data.type === 'join-request') {
            this.handleJoinRequest(conn, data);
        }
    }
}

// ==================== AGREGA esta función para restaurar la X al iniciar nuevo juego ====================

// Busca la función disconnect y agrega esta línea antes de showScreen:
disconnect() {
    // ... código existente ...
    
    // Restaurar la X del modal
    const closeBtn = document.querySelector('#question-modal .close');
    if (closeBtn) {
        closeBtn.style.display = 'flex';
    }
    
    this.showScreen('home-screen');
}
