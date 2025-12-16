<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { LogIn, Eye, EyeOff, AlertCircle } from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const error = ref('');
const isLoading = ref(false);

async function handleSubmit() {
  if (!email.value || !password.value) {
    error.value = 'Preencha todos os campos';
    return;
  }

  isLoading.value = true;
  error.value = '';

  try {
    await authStore.login({
      email: email.value,
      password: password.value,
    });

    const redirect = (route.query.redirect as string) || '/';
    router.push(redirect);
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || 'Erro ao fazer login. Verifique suas credenciais.';
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-[var(--color-bg-secondary)] p-4">
    <div class="bg-[var(--color-bg-elevated)] p-8 rounded-2xl shadow-xl w-full max-w-md border border-[var(--color-border-primary)]">
      <!-- Logo e Titulo -->
      <div class="text-center mb-8">
        <div class="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center overflow-hidden">
          <img src="/logo.png" alt="BI Crepaldi" class="w-full h-full object-contain" />
        </div>
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">BI Crepaldi</h1>
        <p class="text-[var(--color-text-muted)] mt-1">Faca login para continuar</p>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="space-y-5">
        <!-- Email -->
        <div>
          <label
            for="email"
            class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2"
          >
            Email
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            :disabled="isLoading"
            class="w-full px-4 py-3 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all disabled:opacity-50"
            placeholder="seu@email.com"
          />
        </div>

        <!-- Password -->
        <div>
          <label
            for="password"
            class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2"
          >
            Senha
          </label>
          <div class="relative">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              required
              :disabled="isLoading"
              class="w-full px-4 py-3 pr-12 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all disabled:opacity-50"
              placeholder="Sua senha"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <Eye v-if="!showPassword" class="w-5 h-5" />
              <EyeOff v-else class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Error Message -->
        <div
          v-if="error"
          class="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500"
        >
          <AlertCircle class="w-5 h-5 flex-shrink-0" />
          <span class="text-sm">{{ error }}</span>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="isLoading"
          class="w-full py-3 px-4 bg-[var(--color-accent)] text-white rounded-xl font-semibold hover:bg-[var(--color-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-elevated)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <LogIn v-if="!isLoading" class="w-5 h-5" />
          <svg
            v-else
            class="animate-spin w-5 h-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {{ isLoading ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>

      <!-- Footer -->
      <div class="mt-8 pt-6 border-t border-[var(--color-border-primary)] text-center">
        <p class="text-xs text-[var(--color-text-muted)]">
          Grupo Crepaldi - Sistema de Business Intelligence
        </p>
      </div>
    </div>
  </div>
</template>
