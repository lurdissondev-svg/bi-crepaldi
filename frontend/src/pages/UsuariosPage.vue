<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Shield,
  Check,
  X,
  Search,
  UserCog,
  ChevronDown,
  ChevronUp,
} from 'lucide-vue-next';
import api from '@/services/api';
import type { UserListItem, Role, PageDefinition } from '@/types/auth';

// State
const users = ref<UserListItem[]>([]);
const roles = ref<Role[]>([]);
const pages = ref<PageDefinition[]>([]);
const isLoading = ref(true);
const searchQuery = ref('');
const error = ref('');

// Modal states
const showUserModal = ref(false);
const showDeleteModal = ref(false);
const showPermissionsModal = ref(false);
const showRoleModal = ref(false);
const showDeleteRoleModal = ref(false);
const editingUser = ref<UserListItem | null>(null);
const deletingUser = ref<UserListItem | null>(null);
const editingRole = ref<Role | null>(null);
const deletingRole = ref<Role | null>(null);
const expandedRoleId = ref<number | null>(null);

// Form state
const userForm = ref({
  name: '',
  email: '',
  password: '',
  roleId: 0,
  active: true,
});
const roleForm = ref({
  name: '',
  description: '',
});
const isSaving = ref(false);

// Computed
const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value;
  const query = searchQuery.value.toLowerCase();
  return users.value.filter(
    (u) =>
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.role.name.toLowerCase().includes(query)
  );
});

// Methods
async function loadData() {
  isLoading.value = true;
  error.value = '';
  try {
    const [usersData, rolesData, pagesData] = await Promise.all([
      api.getUsers(),
      api.getRoles(),
      api.getPages(),
    ]);
    users.value = usersData;
    roles.value = rolesData;
    pages.value = pagesData;
  } catch (e) {
    error.value = 'Erro ao carregar dados';
    console.error(e);
  } finally {
    isLoading.value = false;
  }
}

function openCreateModal() {
  editingUser.value = null;
  userForm.value = {
    name: '',
    email: '',
    password: '',
    roleId: roles.value[0]?.id || 0,
    active: true,
  };
  showUserModal.value = true;
}

function openEditModal(user: UserListItem) {
  editingUser.value = user;
  userForm.value = {
    name: user.name,
    email: user.email,
    password: '',
    roleId: user.role.id,
    active: user.active,
  };
  showUserModal.value = true;
}

function openDeleteModal(user: UserListItem) {
  deletingUser.value = user;
  showDeleteModal.value = true;
}

async function saveUser() {
  if (!userForm.value.name || !userForm.value.email || !userForm.value.roleId) {
    return;
  }

  isSaving.value = true;
  try {
    if (editingUser.value) {
      // Update
      await api.updateUser(editingUser.value.id, {
        name: userForm.value.name,
        email: userForm.value.email,
        roleId: userForm.value.roleId,
        active: userForm.value.active,
        ...(userForm.value.password ? { password: userForm.value.password } : {}),
      });
    } else {
      // Create
      if (!userForm.value.password) {
        return;
      }
      await api.createUser({
        name: userForm.value.name,
        email: userForm.value.email,
        password: userForm.value.password,
        roleId: userForm.value.roleId,
      });
    }
    showUserModal.value = false;
    await loadData();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || 'Erro ao salvar usuario';
  } finally {
    isSaving.value = false;
  }
}

async function deleteUser() {
  if (!deletingUser.value) return;
  isSaving.value = true;
  try {
    await api.deleteUser(deletingUser.value.id);
    showDeleteModal.value = false;
    deletingUser.value = null;
    await loadData();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || 'Erro ao excluir usuario';
  } finally {
    isSaving.value = false;
  }
}

function toggleRoleExpansion(roleId: number) {
  expandedRoleId.value = expandedRoleId.value === roleId ? null : roleId;
}

async function togglePermission(role: Role, pageSlug: string) {
  const permission = role.permissions.find((p) => p.pageSlug === pageSlug);
  const newValue = !permission?.canView;

  try {
    const updatedPermissions = role.permissions.map((p) =>
      p.pageSlug === pageSlug ? { ...p, canView: newValue } : p
    );

    await api.updateRolePermissions(role.id, updatedPermissions);

    // Update local state
    const roleIndex = roles.value.findIndex((r) => r.id === role.id);
    if (roleIndex !== -1) {
      roles.value[roleIndex].permissions = updatedPermissions;
    }
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || 'Erro ao atualizar permissao';
  }
}

// Role CRUD
function openCreateRoleModal() {
  editingRole.value = null;
  roleForm.value = {
    name: '',
    description: '',
  };
  showRoleModal.value = true;
}

function openEditRoleModal(role: Role, event: Event) {
  event.stopPropagation();
  editingRole.value = role;
  roleForm.value = {
    name: role.name,
    description: role.description || '',
  };
  showRoleModal.value = true;
}

function openDeleteRoleModal(role: Role, event: Event) {
  event.stopPropagation();
  deletingRole.value = role;
  showDeleteRoleModal.value = true;
}

async function saveRole() {
  if (!roleForm.value.name) {
    return;
  }

  isSaving.value = true;
  try {
    if (editingRole.value) {
      // Update
      await api.updateRole(editingRole.value.id, {
        name: roleForm.value.name,
        description: roleForm.value.description,
      });
    } else {
      // Create
      await api.createRole({
        name: roleForm.value.name,
        description: roleForm.value.description,
      });
    }
    showRoleModal.value = false;
    await loadData();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || 'Erro ao salvar cargo';
  } finally {
    isSaving.value = false;
  }
}

async function deleteRole() {
  if (!deletingRole.value) return;
  isSaving.value = true;
  try {
    await api.deleteRole(deletingRole.value.id);
    showDeleteRoleModal.value = false;
    deletingRole.value = null;
    await loadData();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || 'Erro ao excluir cargo';
  } finally {
    isSaving.value = false;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

onMounted(loadData);
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">Gerenciamento de Usuarios</h1>
        <p class="text-[var(--color-text-muted)] mt-1">Gerencie usuarios, cargos e permissoes do sistema</p>
      </div>
      <button
        @click="openCreateModal"
        class="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
      >
        <Plus class="w-5 h-5" />
        Novo Usuario
      </button>
    </div>

    <!-- Error -->
    <div
      v-if="error"
      class="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-2"
    >
      <X class="w-5 h-5" />
      {{ error }}
      <button @click="error = ''" class="ml-auto hover:text-red-400">
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div class="animate-spin w-8 h-8 border-4 border-[var(--color-accent)] border-t-transparent rounded-full"></div>
    </div>

    <template v-else>
      <!-- Users Section -->
      <div class="bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-border-primary)] overflow-hidden">
        <div class="p-4 border-b border-[var(--color-border-primary)] flex flex-col sm:flex-row sm:items-center gap-4">
          <div class="flex items-center gap-2">
            <Users class="w-5 h-5 text-[var(--color-accent)]" />
            <h2 class="text-lg font-semibold text-[var(--color-text-primary)]">Usuarios</h2>
            <span class="px-2 py-0.5 bg-[var(--color-bg-secondary)] rounded-full text-xs text-[var(--color-text-muted)]">
              {{ users.length }}
            </span>
          </div>
          <div class="relative sm:ml-auto">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar usuarios..."
              class="pl-9 pr-4 py-2 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] w-full sm:w-64"
            />
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-[var(--color-bg-secondary)]">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Usuario</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Cargo</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Status</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Ultimo Login</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--color-border-primary)]">
              <tr v-for="user in filteredUsers" :key="user.id" class="hover:bg-[var(--color-bg-secondary)]/50 transition-colors">
                <td class="px-4 py-4">
                  <div>
                    <div class="font-medium text-[var(--color-text-primary)]">{{ user.name }}</div>
                    <div class="text-sm text-[var(--color-text-muted)]">{{ user.email }}</div>
                  </div>
                </td>
                <td class="px-4 py-4">
                  <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                    :class="{
                      'bg-purple-500/10 text-purple-500': user.role.name === 'Admin',
                      'bg-blue-500/10 text-blue-500': user.role.name === 'Diretor',
                      'bg-green-500/10 text-green-500': user.role.name === 'Gerente',
                      'bg-gray-500/10 text-gray-500': user.role.name === 'Operador',
                    }"
                  >
                    <Shield class="w-3 h-3" />
                    {{ user.role.name }}
                  </span>
                </td>
                <td class="px-4 py-4">
                  <span
                    class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                    :class="user.active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'"
                  >
                    <Check v-if="user.active" class="w-3 h-3" />
                    <X v-else class="w-3 h-3" />
                    {{ user.active ? 'Ativo' : 'Inativo' }}
                  </span>
                </td>
                <td class="px-4 py-4 text-sm text-[var(--color-text-muted)]">
                  {{ formatDate(user.lastLoginAt) }}
                </td>
                <td class="px-4 py-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      @click="openEditModal(user)"
                      class="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                      title="Editar"
                    >
                      <Pencil class="w-4 h-4" />
                    </button>
                    <button
                      @click="openDeleteModal(user)"
                      class="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredUsers.length === 0">
                <td colspan="5" class="px-4 py-8 text-center text-[var(--color-text-muted)]">
                  Nenhum usuario encontrado
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Roles & Permissions Section -->
      <div class="bg-[var(--color-bg-elevated)] rounded-xl border border-[var(--color-border-primary)] overflow-hidden">
        <div class="p-4 border-b border-[var(--color-border-primary)]">
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <UserCog class="w-5 h-5 text-[var(--color-accent)]" />
                <h2 class="text-lg font-semibold text-[var(--color-text-primary)]">Cargos e Permissoes</h2>
              </div>
              <p class="text-sm text-[var(--color-text-muted)] mt-1">Clique em um cargo para gerenciar as permissoes de acesso as paginas</p>
            </div>
            <button
              @click="openCreateRoleModal"
              class="inline-flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] rounded-lg font-medium hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <Plus class="w-4 h-4" />
              Novo Cargo
            </button>
          </div>
        </div>

        <div class="divide-y divide-[var(--color-border-primary)]">
          <div v-for="role in roles" :key="role.id">
            <!-- Role Header -->
            <button
              @click="toggleRoleExpansion(role.id)"
              class="w-full px-4 py-4 flex items-center justify-between hover:bg-[var(--color-bg-secondary)]/50 transition-colors"
            >
              <div class="flex items-center gap-3">
                <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                  :class="{
                    'bg-purple-500/10 text-purple-500': role.name === 'Admin',
                    'bg-blue-500/10 text-blue-500': role.name === 'Diretor',
                    'bg-green-500/10 text-green-500': role.name === 'Gerente',
                    'bg-gray-500/10 text-gray-500': role.name === 'Operador',
                  }"
                >
                  <Shield class="w-3 h-3" />
                  {{ role.name }}
                </span>
                <span class="text-sm text-[var(--color-text-muted)]">{{ role.description }}</span>
                <span v-if="role.isSystemRole" class="text-xs px-2 py-0.5 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
                  Sistema
                </span>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-sm text-[var(--color-text-muted)]">
                  {{ role.usersCount }} usuario{{ role.usersCount !== 1 ? 's' : '' }}
                </span>
                <!-- Edit/Delete buttons for non-system roles -->
                <div v-if="!role.isSystemRole" class="flex items-center gap-1" @click.stop>
                  <button
                    @click="openEditRoleModal(role, $event)"
                    class="p-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                    title="Editar cargo"
                  >
                    <Pencil class="w-4 h-4" />
                  </button>
                  <button
                    @click="openDeleteRoleModal(role, $event)"
                    :disabled="role.usersCount > 0"
                    class="p-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    :title="role.usersCount > 0 ? 'Nao e possivel excluir cargo com usuarios' : 'Excluir cargo'"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
                <!-- Edit button for system roles (can only edit description) -->
                <div v-else class="flex items-center gap-1" @click.stop>
                  <button
                    @click="openEditRoleModal(role, $event)"
                    class="p-1.5 rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                    title="Editar descricao"
                  >
                    <Pencil class="w-4 h-4" />
                  </button>
                </div>
                <ChevronDown v-if="expandedRoleId !== role.id" class="w-5 h-5 text-[var(--color-text-muted)]" />
                <ChevronUp v-else class="w-5 h-5 text-[var(--color-text-muted)]" />
              </div>
            </button>

            <!-- Permissions Grid -->
            <div v-if="expandedRoleId === role.id" class="px-4 py-4 bg-[var(--color-bg-secondary)]/30 border-t border-[var(--color-border-primary)]">
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <div
                  v-for="page in pages"
                  :key="page.slug"
                  class="relative"
                >
                  <button
                    @click="togglePermission(role, page.slug)"
                    :disabled="role.name === 'Admin' || role.name === 'Diretor'"
                    class="w-full p-3 rounded-lg border transition-all text-left"
                    :class="[
                      role.permissions.find(p => p.pageSlug === page.slug)?.canView
                        ? 'border-green-500/50 bg-green-500/10'
                        : 'border-[var(--color-border-primary)] bg-[var(--color-bg-primary)]',
                      role.name === 'Admin' || role.name === 'Diretor'
                        ? 'cursor-not-allowed opacity-60'
                        : 'hover:border-[var(--color-accent)] cursor-pointer'
                    ]"
                  >
                    <div class="flex items-center justify-between mb-1">
                      <span class="font-medium text-sm text-[var(--color-text-primary)]">{{ page.name }}</span>
                      <Check
                        v-if="role.permissions.find(p => p.pageSlug === page.slug)?.canView"
                        class="w-4 h-4 text-green-500"
                      />
                    </div>
                    <p class="text-xs text-[var(--color-text-muted)] line-clamp-2">{{ page.description }}</p>
                  </button>
                </div>
              </div>
              <p v-if="role.name === 'Admin' || role.name === 'Diretor'" class="text-xs text-[var(--color-text-muted)] mt-3">
                * Cargos Admin e Diretor tem acesso total e nao podem ser modificados
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- User Modal -->
    <Teleport to="body">
      <div
        v-if="showUserModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        @click.self="showUserModal = false"
      >
        <div class="bg-[var(--color-bg-elevated)] rounded-2xl w-full max-w-md border border-[var(--color-border-primary)] shadow-xl">
          <div class="p-6 border-b border-[var(--color-border-primary)]">
            <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">
              {{ editingUser ? 'Editar Usuario' : 'Novo Usuario' }}
            </h3>
          </div>

          <form @submit.prevent="saveUser" class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Nome</label>
              <input
                v-model="userForm.name"
                type="text"
                required
                class="w-full px-4 py-2 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="Nome completo"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Email</label>
              <input
                v-model="userForm.email"
                type="email"
                required
                class="w-full px-4 py-2 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="email@exemplo.com"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Senha {{ editingUser ? '(deixe em branco para manter)' : '' }}
              </label>
              <input
                v-model="userForm.password"
                type="password"
                :required="!editingUser"
                class="w-full px-4 py-2 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="Minimo 6 caracteres"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Cargo</label>
              <select
                v-model="userForm.roleId"
                required
                class="w-full px-4 py-2 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                <option v-for="role in roles" :key="role.id" :value="role.id">
                  {{ role.name }}
                </option>
              </select>
            </div>

            <div v-if="editingUser" class="flex items-center gap-3">
              <input
                id="active"
                v-model="userForm.active"
                type="checkbox"
                class="w-4 h-4 rounded border-[var(--color-border-primary)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              />
              <label for="active" class="text-sm text-[var(--color-text-secondary)]">Usuario ativo</label>
            </div>

            <div class="flex gap-3 pt-4">
              <button
                type="button"
                @click="showUserModal = false"
                class="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="isSaving"
                class="flex-1 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
              >
                {{ isSaving ? 'Salvando...' : 'Salvar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showDeleteModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        @click.self="showDeleteModal = false"
      >
        <div class="bg-[var(--color-bg-elevated)] rounded-2xl w-full max-w-sm border border-[var(--color-border-primary)] shadow-xl p-6">
          <div class="text-center">
            <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <Trash2 class="w-6 h-6 text-red-500" />
            </div>
            <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Excluir Usuario</h3>
            <p class="text-[var(--color-text-muted)] mb-6">
              Tem certeza que deseja excluir <strong>{{ deletingUser?.name }}</strong>? Esta acao ira desativar o usuario.
            </p>
            <div class="flex gap-3">
              <button
                @click="showDeleteModal = false"
                class="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                Cancelar
              </button>
              <button
                @click="deleteUser"
                :disabled="isSaving"
                class="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {{ isSaving ? 'Excluindo...' : 'Excluir' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Role Modal -->
    <Teleport to="body">
      <div
        v-if="showRoleModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        @click.self="showRoleModal = false"
      >
        <div class="bg-[var(--color-bg-elevated)] rounded-2xl w-full max-w-md border border-[var(--color-border-primary)] shadow-xl">
          <div class="p-6 border-b border-[var(--color-border-primary)]">
            <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">
              {{ editingRole ? 'Editar Cargo' : 'Novo Cargo' }}
            </h3>
          </div>

          <form @submit.prevent="saveRole" class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Nome do Cargo</label>
              <input
                v-model="roleForm.name"
                type="text"
                required
                :disabled="editingRole?.isSystemRole"
                class="w-full px-4 py-2 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Ex: Supervisor"
              />
              <p v-if="editingRole?.isSystemRole" class="text-xs text-[var(--color-text-muted)] mt-1">
                * Cargos do sistema nao podem ter o nome alterado
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Descricao</label>
              <textarea
                v-model="roleForm.description"
                rows="3"
                class="w-full px-4 py-2 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-none"
                placeholder="Descreva as responsabilidades deste cargo..."
              ></textarea>
            </div>

            <div class="flex gap-3 pt-4">
              <button
                type="button"
                @click="showRoleModal = false"
                class="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="isSaving"
                class="flex-1 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
              >
                {{ isSaving ? 'Salvando...' : 'Salvar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete Role Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showDeleteRoleModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        @click.self="showDeleteRoleModal = false"
      >
        <div class="bg-[var(--color-bg-elevated)] rounded-2xl w-full max-w-sm border border-[var(--color-border-primary)] shadow-xl p-6">
          <div class="text-center">
            <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <Trash2 class="w-6 h-6 text-red-500" />
            </div>
            <h3 class="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Excluir Cargo</h3>
            <p class="text-[var(--color-text-muted)] mb-6">
              Tem certeza que deseja excluir o cargo <strong>{{ deletingRole?.name }}</strong>? Esta acao nao pode ser desfeita.
            </p>
            <div class="flex gap-3">
              <button
                @click="showDeleteRoleModal = false"
                class="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                Cancelar
              </button>
              <button
                @click="deleteRole"
                :disabled="isSaving"
                class="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {{ isSaving ? 'Excluindo...' : 'Excluir' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
