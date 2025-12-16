export interface PagePermission {
  pageSlug: string;
  canView: boolean;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  isSystemRole: boolean;
  permissions: PagePermission[];
  usersCount?: number;
}

export interface User {
  id: number;
  email: string;
  name: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  role: Role;
}

export interface UserListItem {
  id: number;
  email: string;
  name: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  role: {
    id: number;
    name: string;
    description: string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  roleId: number;
}

export interface UpdateUserDto {
  email?: string;
  password?: string;
  name?: string;
  roleId?: number;
  active?: boolean;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface PageDefinition {
  slug: string;
  name: string;
  description: string;
}
