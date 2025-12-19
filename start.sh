#!/bin/bash

# ============================================
# Script de Inicialização - BI Crepaldi
# ============================================
# Este script inicia o backend e frontend do projeto
#
# USO:
#   ./start.sh          - Inicia backend + frontend
#   ./start.sh backend  - Inicia apenas o backend
#   ./start.sh frontend - Inicia apenas o frontend
#   ./start.sh stop     - Para todos os processos
#   ./start.sh status   - Mostra status dos processos
# ============================================

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Diretório base do projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Arquivos de PID
BACKEND_PID_FILE="$PROJECT_DIR/.backend.pid"
FRONTEND_PID_FILE="$PROJECT_DIR/.frontend.pid"

# Portas
BACKEND_PORT=3001
FRONTEND_PORT=5173

# Função para mostrar mensagem colorida
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Função para verificar se porta está em uso
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0 # porta em uso
    else
        return 1 # porta livre
    fi
}

# Função para iniciar o backend
start_backend() {
    log_info "Iniciando Backend na porta $BACKEND_PORT..."

    if check_port $BACKEND_PORT; then
        log_warn "Porta $BACKEND_PORT já está em uso!"
        return 1
    fi

    cd "$BACKEND_DIR"
    npm run dev > "$PROJECT_DIR/backend.log" 2>&1 &
    echo $! > "$BACKEND_PID_FILE"

    # Aguarda o servidor iniciar
    sleep 2

    if check_port $BACKEND_PORT; then
        log_success "Backend iniciado! PID: $(cat $BACKEND_PID_FILE)"
        log_info "API disponível em: http://localhost:$BACKEND_PORT"
    else
        log_error "Falha ao iniciar o backend. Verifique backend.log"
        return 1
    fi
}

# Função para iniciar o frontend
start_frontend() {
    log_info "Iniciando Frontend na porta $FRONTEND_PORT..."

    if check_port $FRONTEND_PORT; then
        log_warn "Porta $FRONTEND_PORT já está em uso!"
        return 1
    fi

    cd "$FRONTEND_DIR"
    npm run dev > "$PROJECT_DIR/frontend.log" 2>&1 &
    echo $! > "$FRONTEND_PID_FILE"

    # Aguarda o servidor iniciar
    sleep 3

    if check_port $FRONTEND_PORT; then
        log_success "Frontend iniciado! PID: $(cat $FRONTEND_PID_FILE)"
        log_info "Dashboard disponível em: http://localhost:$FRONTEND_PORT"
    else
        log_error "Falha ao iniciar o frontend. Verifique frontend.log"
        return 1
    fi
}

# Função para parar processo pelo arquivo PID
stop_process() {
    local pid_file=$1
    local name=$2

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            kill $pid 2>/dev/null
            log_success "$name parado (PID: $pid)"
        fi
        rm -f "$pid_file"
    fi
}

# Função para parar todos os processos
stop_all() {
    log_info "Parando todos os processos..."

    stop_process "$BACKEND_PID_FILE" "Backend"
    stop_process "$FRONTEND_PID_FILE" "Frontend"

    # Mata processos órfãos nas portas
    if check_port $BACKEND_PORT; then
        local pid=$(lsof -ti :$BACKEND_PORT)
        kill $pid 2>/dev/null
        log_warn "Processo na porta $BACKEND_PORT encerrado"
    fi

    if check_port $FRONTEND_PORT; then
        local pid=$(lsof -ti :$FRONTEND_PORT)
        kill $pid 2>/dev/null
        log_warn "Processo na porta $FRONTEND_PORT encerrado"
    fi

    log_success "Todos os processos parados!"
}

# Função para mostrar status
show_status() {
    echo ""
    echo "=========================================="
    echo "        STATUS DO BI CREPALDI"
    echo "=========================================="
    echo ""

    # Backend
    if check_port $BACKEND_PORT; then
        local pid=$(lsof -ti :$BACKEND_PORT)
        echo -e "Backend:  ${GREEN}● RODANDO${NC} (PID: $pid)"
        echo -e "          http://localhost:$BACKEND_PORT"
    else
        echo -e "Backend:  ${RED}○ PARADO${NC}"
    fi

    echo ""

    # Frontend
    if check_port $FRONTEND_PORT; then
        local pid=$(lsof -ti :$FRONTEND_PORT)
        echo -e "Frontend: ${GREEN}● RODANDO${NC} (PID: $pid)"
        echo -e "          http://localhost:$FRONTEND_PORT"
    else
        echo -e "Frontend: ${RED}○ PARADO${NC}"
    fi

    echo ""
    echo "=========================================="
    echo ""
}

# Função para mostrar ajuda
show_help() {
    echo ""
    echo "=========================================="
    echo "     BI CREPALDI - Script de Início"
    echo "=========================================="
    echo ""
    echo "USO:"
    echo "  ./start.sh              Inicia backend + frontend"
    echo "  ./start.sh backend      Inicia apenas o backend"
    echo "  ./start.sh frontend     Inicia apenas o frontend"
    echo "  ./start.sh stop         Para todos os processos"
    echo "  ./start.sh status       Mostra status dos processos"
    echo "  ./start.sh help         Mostra esta ajuda"
    echo ""
    echo "LOGS:"
    echo "  Backend:  $PROJECT_DIR/backend.log"
    echo "  Frontend: $PROJECT_DIR/frontend.log"
    echo ""
    echo "PORTAS:"
    echo "  Backend:  http://localhost:$BACKEND_PORT"
    echo "  Frontend: http://localhost:$FRONTEND_PORT"
    echo ""
}

# Main
case "$1" in
    backend)
        start_backend
        ;;
    frontend)
        start_frontend
        ;;
    stop)
        stop_all
        ;;
    status)
        show_status
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        # Inicia ambos
        echo ""
        echo "=========================================="
        echo "     BI CREPALDI - Iniciando Projeto"
        echo "=========================================="
        echo ""

        start_backend
        start_frontend

        echo ""
        echo "=========================================="
        echo ""
        log_success "Projeto iniciado com sucesso!"
        echo ""
        echo "  Dashboard: http://localhost:$FRONTEND_PORT"
        echo "  API:       http://localhost:$BACKEND_PORT"
        echo ""
        echo "  Para parar: ./start.sh stop"
        echo "=========================================="
        echo ""
        ;;
esac
