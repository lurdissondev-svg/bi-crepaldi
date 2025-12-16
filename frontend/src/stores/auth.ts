import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User, LoginCredentials } from '@/types/auth';
import api from '@/services/api';

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null);
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'));
  const isLoading = ref(false);
  const isInitialized = ref(false);

  // Getters
  const isAuthenticated = computed(() => !!accessToken.value && !!user.value);

  const canViewPage = computed(() => (pageSlug: string): boolean => {
    if (!user.value) return false;
    // Admin and Diretor always have full access
    if (['Admin', 'Diretor'].includes(user.value.role.name)) return true;
    // Check permissions
    const permission = user.value.role.permissions.find(
      (p) => p.pageSlug === pageSlug
    );
    return permission?.canView ?? false;
  });

  const canManageUsers = computed(() => {
    if (!user.value) return false;
    return ['Admin', 'Diretor'].includes(user.value.role.name);
  });

  const userDisplayName = computed(() => {
    if (!user.value) return '';
    return user.value.name.split(' ')[0]; // First name only
  });

  // Actions
  async function login(credentials: LoginCredentials): Promise<boolean> {
    isLoading.value = true;
    try {
      const response = await api.login(credentials);
      accessToken.value = response.accessToken;
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
      user.value = response.user;
      return true;
    } catch (error) {
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  async function logout(): Promise<void> {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await api.logout(refreshToken).catch(() => {});
      }
    } finally {
      user.value = null;
      accessToken.value = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  async function fetchCurrentUser(): Promise<void> {
    if (!accessToken.value) {
      isInitialized.value = true;
      return;
    }

    try {
      const userData = await api.getCurrentUser();
      user.value = userData;
    } catch {
      // Token invalid, clear everything
      await logout();
    } finally {
      isInitialized.value = true;
    }
  }

  async function refreshAccessToken(): Promise<void> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    try {
      const response = await api.refreshToken(refreshToken);
      accessToken.value = response.accessToken;
      localStorage.setItem('accessToken', response.accessToken);
    } catch {
      // Refresh failed, logout
      await logout();
      throw new Error('Session expired');
    }
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.changePassword(currentPassword, newPassword);
    // After password change, user needs to login again
    await logout();
  }

  function initialize(): Promise<void> {
    if (isInitialized.value) {
      return Promise.resolve();
    }
    return fetchCurrentUser();
  }

  return {
    // State
    user,
    accessToken,
    isLoading,
    isInitialized,
    // Getters
    isAuthenticated,
    canViewPage,
    canManageUsers,
    userDisplayName,
    // Actions
    login,
    logout,
    fetchCurrentUser,
    refreshAccessToken,
    changePassword,
    initialize,
  };
});
