# Authentication Flow Examples for Different Platforms

This document provides comprehensive authentication implementation examples for various platforms and frameworks, including web applications, mobile apps, and server-to-server integrations.

## Web Applications

### 1. React.js Implementation

#### Authentication Context and Hooks

```jsx
// contexts/AuthContext.js
import React, { createContext, useContext, useReducer, useEffect } from 'react';

const AuthContext = createContext();

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, loading: true, error: null };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        loading: false,
        isAuthenticated: true,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
        error: null
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        loading: false,
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: null,
        error: action.payload
      };
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: null,
        error: null
      };
    case 'TOKEN_REFRESHED':
      return {
        ...state,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    isAuthenticated: false,
    user: null,
    accessToken: null,
    refreshToken: null,
    loading: false,
    error: null
  });

  // Check for stored authentication on app start
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('accessToken');
      const storedUser = localStorage.getItem('user');
      const storedRefreshToken = localStorage.getItem('refreshToken');

      if (storedToken && storedUser && storedRefreshToken) {
        // Verify token is still valid
        try {
          const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${storedToken}` }
          });

          if (response.ok) {
            const userData = await response.json();
            dispatch({
              type: 'LOGIN_SUCCESS',
              payload: {
                user: userData.user,
                accessToken: storedToken,
                refreshToken: storedRefreshToken
              }
            });
          } else {
            // Token invalid, try refresh
            await refreshToken(storedRefreshToken);
          }
        } catch (error) {
          // Clear invalid tokens
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        }
      }
    };

    initAuth();
  }, []);

  const login = async (credentials) => {
    dispatch({ type: 'LOGIN_START' });

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (data.success) {
        // Store tokens securely
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));

        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: data
        });

        return { success: true };
      } else {
        dispatch({
          type: 'LOGIN_FAILURE',
          payload: data.error.message
        });
        return { success: false, error: data.error.message };
      }
    } catch (error) {
      const errorMessage = 'Network error. Please try again.';
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  };

  const register = async (userData) => {
    dispatch({ type: 'LOGIN_START' });

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));

        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: data
        });

        return { success: true };
      } else {
        dispatch({
          type: 'LOGIN_FAILURE',
          payload: data.error.message
        });
        return { success: false, error: data.error.message };
      }
    } catch (error) {
      const errorMessage = 'Registration failed. Please try again.';
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      if (state.accessToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${state.accessToken}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      // Clear local storage regardless of API response
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');

      dispatch({ type: 'LOGOUT' });
    }
  };

  const refreshToken = async (refreshTokenValue) => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshTokenValue })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        dispatch({
          type: 'TOKEN_REFRESHED',
          payload: data
        });

        return data.accessToken;
      } else {
        // Refresh failed, logout user
        logout();
        return null;
      }
    } catch (error) {
      logout();
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      register,
      logout,
      refreshToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

#### API Client with Automatic Token Refresh

```javascript
// services/apiClient.js
import { useAuth } from '../contexts/AuthContext';

class ApiClient {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
    this.isRefreshing = false;
    this.failedQueue = [];
  }

  setAuthContext(authContext) {
    this.authContext = authContext;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    // Add auth token if available
    if (this.authContext?.accessToken) {
      config.headers.Authorization = `Bearer ${this.authContext.accessToken}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 && !options._retry) {
          return this.handleTokenRefresh(endpoint, options);
        }
        throw new ApiError(data.error?.message || 'Request failed', response.status, data);
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Network error', 0, { originalError: error });
    }
  }

  async handleTokenRefresh(endpoint, options) {
    if (this.isRefreshing) {
      // Queue the request while refresh is in progress
      return new Promise((resolve, reject) => {
        this.failedQueue.push({ resolve, reject, endpoint, options });
      });
    }

    this.isRefreshing = true;

    try {
      const newToken = await this.authContext.refreshToken(this.authContext.refreshToken);
      
      if (newToken) {
        this.processQueue(null, newToken);
        
        // Retry original request with new token
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`
        };
        options._retry = true;
        
        return this.request(endpoint, options);
      } else {
        this.processQueue(new Error('Token refresh failed'), null);
        throw new ApiError('Authentication failed', 401);
      }
    } catch (error) {
      this.processQueue(error, null);
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  processQueue(error, token) {
    this.failedQueue.forEach(({ resolve, reject, endpoint, options }) => {
      if (error) {
        reject(error);
      } else {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${token}`
        };
        resolve(this.request(endpoint, options));
      }
    });

    this.failedQueue = [];
  }

  // Convenience methods
  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const apiClient = new ApiClient();
export { ApiError };
```

#### Login Component

```jsx
// components/LoginForm.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const result = await login(formData);
    if (result.success) {
      navigate('/dashboard');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2>Sign In</h2>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="password-input">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="login-button"
          disabled={loading}
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>

        <div className="form-footer">
          <a href="/register">Don't have an account? Sign up</a>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;
```

### 2. Vue.js Implementation

```javascript
// stores/auth.js (Pinia store)
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const accessToken = ref(null);
  const refreshToken = ref(null);
  const loading = ref(false);
  const error = ref(null);

  const isAuthenticated = computed(() => !!accessToken.value);

  const login = async (credentials) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (data.success) {
        user.value = data.user;
        accessToken.value = data.accessToken;
        refreshToken.value = data.refreshToken;

        // Store in localStorage
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));

        return { success: true };
      } else {
        error.value = data.error.message;
        return { success: false, error: data.error.message };
      }
    } catch (err) {
      error.value = 'Network error. Please try again.';
      return { success: false, error: error.value };
    } finally {
      loading.value = false;
    }
  };

  const logout = async () => {
    try {
      if (accessToken.value) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken.value}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (err) {
      console.warn('Logout request failed:', err);
    } finally {
      user.value = null;
      accessToken.value = null;
      refreshToken.value = null;
      
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  };

  const initializeAuth = () => {
    const storedToken = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');
    const storedRefreshToken = localStorage.getItem('refreshToken');

    if (storedToken && storedUser && storedRefreshToken) {
      accessToken.value = storedToken;
      refreshToken.value = storedRefreshToken;
      user.value = JSON.parse(storedUser);
    }
  };

  return {
    user,
    accessToken,
    refreshToken,
    loading,
    error,
    isAuthenticated,
    login,
    logout,
    initializeAuth
  };
});
```

## Mobile Applications

### 1. React Native Implementation

```javascript
// services/AuthService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

class AuthService {
  constructor() {
    this.baseURL = 'https://api.visitormanagement.com/api';
    this.listeners = [];
  }

  // Secure token storage using Keychain
  async storeTokens(accessToken, refreshToken) {
    try {
      await Keychain.setInternetCredentials(
        'visitor-management-tokens',
        'tokens',
        JSON.stringify({
          accessToken,
          refreshToken,
          timestamp: Date.now()
        })
      );
    } catch (error) {
      console.error('Failed to store tokens:', error);
      // Fallback to AsyncStorage (less secure)
      await AsyncStorage.setItem('tokens', JSON.stringify({
        accessToken,
        refreshToken,
        timestamp: Date.now()
      }));
    }
  }

  async getTokens() {
    try {
      const credentials = await Keychain.getInternetCredentials('visitor-management-tokens');
      if (credentials) {
        return JSON.parse(credentials.password);
      }
    } catch (error) {
      console.error('Failed to get tokens from Keychain:', error);
      // Fallback to AsyncStorage
      const tokens = await AsyncStorage.getItem('tokens');
      return tokens ? JSON.parse(tokens) : null;
    }
    return null;
  }

  async clearTokens() {
    try {
      await Keychain.resetInternetCredentials('visitor-management-tokens');
    } catch (error) {
      console.error('Failed to clear tokens from Keychain:', error);
    }
    
    try {
      await AsyncStorage.removeItem('tokens');
      await AsyncStorage.removeItem('user');
    } catch (error) {
      console.error('Failed to clear AsyncStorage:', error);
    }
  }

  async login(credentials) {
    try {
      const response = await fetch(`${this.baseURL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (data.success) {
        await this.storeTokens(data.accessToken, data.refreshToken);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        
        this.notifyListeners('login', data.user);
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error.message };
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  async register(userData) {
    try {
      const response = await fetch(`${this.baseURL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (data.success) {
        await this.storeTokens(data.accessToken, data.refreshToken);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        
        this.notifyListeners('login', data.user);
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error.message };
      }
    } catch (error) {
      return { success: false, error: 'Registration failed. Please try again.' };
    }
  }

  async logout() {
    try {
      const tokens = await this.getTokens();
      if (tokens?.accessToken) {
        await fetch(`${this.baseURL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      await this.clearTokens();
      this.notifyListeners('logout');
    }
  }

  async refreshToken() {
    try {
      const tokens = await this.getTokens();
      if (!tokens?.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken })
      });

      const data = await response.json();

      if (data.success) {
        await this.storeTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
      } else {
        await this.logout();
        return null;
      }
    } catch (error) {
      await this.logout();
      return null;
    }
  }

  async getCurrentUser() {
    try {
      const userStr = await AsyncStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      return null;
    }
  }

  async isAuthenticated() {
    const tokens = await this.getTokens();
    return !!tokens?.accessToken;
  }

  // Event listeners for auth state changes
  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  notifyListeners(event, data) {
    this.listeners.forEach(callback => callback(event, data));
  }
}

export default new AuthService();
```

#### React Native Auth Context

```jsx
// contexts/AuthContext.js
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AuthService from '../services/AuthService';

const AuthContext = createContext();

const authReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_USER':
      return { ...state, user: action.payload, isAuthenticated: !!action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    isAuthenticated: false,
    loading: true,
    error: null
  });

  useEffect(() => {
    initializeAuth();
    
    // Listen for auth state changes
    const handleAuthChange = (event, data) => {
      if (event === 'login') {
        dispatch({ type: 'SET_USER', payload: data });
      } else if (event === 'logout') {
        dispatch({ type: 'SET_USER', payload: null });
      }
    };

    AuthService.addListener(handleAuthChange);

    return () => {
      AuthService.removeListener(handleAuthChange);
    };
  }, []);

  const initializeAuth = async () => {
    try {
      const isAuth = await AuthService.isAuthenticated();
      if (isAuth) {
        const user = await AuthService.getCurrentUser();
        dispatch({ type: 'SET_USER', payload: user });
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const login = async (credentials) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });

    const result = await AuthService.login(credentials);
    
    if (!result.success) {
      dispatch({ type: 'SET_ERROR', payload: result.error });
    }
    
    dispatch({ type: 'SET_LOADING', payload: false });
    return result;
  };

  const register = async (userData) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });

    const result = await AuthService.register(userData);
    
    if (!result.success) {
      dispatch({ type: 'SET_ERROR', payload: result.error });
    }
    
    dispatch({ type: 'SET_LOADING', payload: false });
    return result;
  };

  const logout = async () => {
    await AuthService.logout();
  };

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      register,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

### 2. Flutter Implementation

```dart
// services/auth_service.dart
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class AuthService {
  static const String _baseUrl = 'https://api.visitormanagement.com/api';
  static const FlutterSecureStorage _storage = FlutterSecureStorage();
  
  // Store tokens securely
  static Future<void> _storeTokens(String accessToken, String refreshToken) async {
    await _storage.write(key: 'access_token', value: accessToken);
    await _storage.write(key: 'refresh_token', value: refreshToken);
  }
  
  // Get stored tokens
  static Future<Map<String, String?>> _getTokens() async {
    final accessToken = await _storage.read(key: 'access_token');
    final refreshToken = await _storage.read(key: 'refresh_token');
    return {
      'accessToken': accessToken,
      'refreshToken': refreshToken,
    };
  }
  
  // Clear stored tokens
  static Future<void> _clearTokens() async {
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'refresh_token');
    await _storage.delete(key: 'user');
  }
  
  // Login
  static Future<AuthResult> login(String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'password': password,
        }),
      );
      
      final data = jsonDecode(response.body);
      
      if (data['success']) {
        await _storeTokens(data['accessToken'], data['refreshToken']);
        await _storage.write(key: 'user', value: jsonEncode(data['user']));
        
        return AuthResult(
          success: true,
          user: User.fromJson(data['user']),
        );
      } else {
        return AuthResult(
          success: false,
          error: data['error']['message'],
        );
      }
    } catch (e) {
      return AuthResult(
        success: false,
        error: 'Network error. Please try again.',
      );
    }
  }
  
  // Register
  static Future<AuthResult> register(Map<String, String> userData) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/auth/register'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(userData),
      );
      
      final data = jsonDecode(response.body);
      
      if (data['success']) {
        await _storeTokens(data['accessToken'], data['refreshToken']);
        await _storage.write(key: 'user', value: jsonEncode(data['user']));
        
        return AuthResult(
          success: true,
          user: User.fromJson(data['user']),
        );
      } else {
        return AuthResult(
          success: false,
          error: data['error']['message'],
        );
      }
    } catch (e) {
      return AuthResult(
        success: false,
        error: 'Registration failed. Please try again.',
      );
    }
  }
  
  // Logout
  static Future<void> logout() async {
    try {
      final tokens = await _getTokens();
      if (tokens['accessToken'] != null) {
        await http.post(
          Uri.parse('$_baseUrl/auth/logout'),
          headers: {
            'Authorization': 'Bearer ${tokens['accessToken']}',
            'Content-Type': 'application/json',
          },
        );
      }
    } catch (e) {
      print('Logout request failed: $e');
    } finally {
      await _clearTokens();
    }
  }
  
  // Refresh token
  static Future<String?> refreshToken() async {
    try {
      final tokens = await _getTokens();
      if (tokens['refreshToken'] == null) return null;
      
      final response = await http.post(
        Uri.parse('$_baseUrl/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'refreshToken': tokens['refreshToken'],
        }),
      );
      
      final data = jsonDecode(response.body);
      
      if (data['success']) {
        await _storeTokens(data['accessToken'], data['refreshToken']);
        return data['accessToken'];
      } else {
        await logout();
        return null;
      }
    } catch (e) {
      await logout();
      return null;
    }
  }
  
  // Check if user is authenticated
  static Future<bool> isAuthenticated() async {
    final tokens = await _getTokens();
    return tokens['accessToken'] != null;
  }
  
  // Get current user
  static Future<User?> getCurrentUser() async {
    try {
      final userStr = await _storage.read(key: 'user');
      if (userStr != null) {
        return User.fromJson(jsonDecode(userStr));
      }
    } catch (e) {
      print('Failed to get current user: $e');
    }
    return null;
  }
}

// Data models
class AuthResult {
  final bool success;
  final User? user;
  final String? error;
  
  AuthResult({required this.success, this.user, this.error});
}

class User {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? lastLoginAt;
  
  User({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.isActive,
    required this.createdAt,
    required this.updatedAt,
    this.lastLoginAt,
  });
  
  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      email: json['email'],
      firstName: json['firstName'],
      lastName: json['lastName'],
      isActive: json['isActive'],
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
      lastLoginAt: json['lastLoginAt'] != null 
          ? DateTime.parse(json['lastLoginAt']) 
          : null,
    );
  }
}
```

## Server-to-Server Authentication

### 1. Node.js Service Integration

```javascript
// services/VisitorManagementClient.js
const axios = require('axios');

class VisitorManagementClient {
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'https://api.visitormanagement.com/api';
    this.email = options.email;
    this.password = options.password;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    
    // Create axios instance with interceptors
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
    });
    
    this.setupInterceptors();
  }
  
  setupInterceptors() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        await this.ensureValidToken();
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Response interceptor to handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && !error.config._retry) {
          error.config._retry = true;
          
          try {
            await this.refreshAccessToken();
            error.config.headers.Authorization = `Bearer ${this.accessToken}`;
            return this.client.request(error.config);
          } catch (refreshError) {
            // Refresh failed, re-authenticate
            await this.authenticate();
            error.config.headers.Authorization = `Bearer ${this.accessToken}`;
            return this.client.request(error.config);
          }
        }
        
        return Promise.reject(error);
      }
    );
  }
  
  async authenticate() {
    try {
      const response = await axios.post(`${this.baseURL}/auth/login`, {
        email: this.email,
        password: this.password,
      });
      
      if (response.data.success) {
        this.accessToken = response.data.accessToken;
        this.refreshToken = response.data.refreshToken;
        
        // Decode token to get expiry (simplified)
        const tokenPayload = JSON.parse(
          Buffer.from(this.accessToken.split('.')[1], 'base64').toString()
        );
        this.tokenExpiry = new Date(tokenPayload.exp * 1000);
        
        return true;
      } else {
        throw new Error(response.data.error?.message || 'Authentication failed');
      }
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }
  
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    try {
      const response = await axios.post(`${this.baseURL}/auth/refresh`, {
        refreshToken: this.refreshToken,
      });
      
      if (response.data.success) {
        this.accessToken = response.data.accessToken;
        this.refreshToken = response.data.refreshToken;
        
        const tokenPayload = JSON.parse(
          Buffer.from(this.accessToken.split('.')[1], 'base64').toString()
        );
        this.tokenExpiry = new Date(tokenPayload.exp * 1000);
        
        return true;
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
      throw error;
    }
  }
  
  async ensureValidToken() {
    if (!this.accessToken) {
      await this.authenticate();
      return;
    }
    
    // Check if token is about to expire (5 minutes buffer)
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    
    if (this.tokenExpiry && (this.tokenExpiry.getTime() - now.getTime()) < bufferTime) {
      try {
        await this.refreshAccessToken();
      } catch (error) {
        await this.authenticate();
      }
    }
  }
  
  // API methods
  async getVisitors(filters = {}) {
    const response = await this.client.get('/visitors', { params: filters });
    return response.data;
  }
  
  async createVisitor(visitorData) {
    const response = await this.client.post('/visitors', visitorData);
    return response.data;
  }
  
  async updateVisitor(id, updates) {
    const response = await this.client.put(`/visitors/${id}`, updates);
    return response.data;
  }
  
  async deleteVisitor(id) {
    const response = await this.client.delete(`/visitors/${id}`);
    return response.data;
  }
  
  async syncVisitors(operations) {
    const response = await this.client.post('/visitors/bulk-sync', {
      operations: operations,
    });
    return response.data;
  }
  
  async getAnalytics(type, params = {}) {
    let endpoint;
    switch (type) {
      case 'daily':
        endpoint = `/analytics/daily/${params.date}`;
        break;
      case 'monthly':
        endpoint = `/analytics/monthly/${params.year}/${params.month}`;
        break;
      case 'report':
        endpoint = '/analytics/report';
        break;
      default:
        throw new Error(`Unknown analytics type: ${type}`);
    }
    
    const response = await this.client.get(endpoint, { params });
    return response.data;
  }
}

module.exports = VisitorManagementClient;
```

### 2. Python Service Integration

```python
# visitor_management_client.py
import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

class VisitorManagementClient:
    def __init__(self, base_url: str = None, email: str = None, password: str = None):
        self.base_url = base_url or 'https://api.visitormanagement.com/api'
        self.email = email
        self.password = password
        self.access_token = None
        self.refresh_token = None
        self.token_expiry = None
        self.session = requests.Session()
        
    def authenticate(self) -> bool:
        """Authenticate with the API and get tokens."""
        try:
            response = self.session.post(
                f'{self.base_url}/auth/login',
                json={
                    'email': self.email,
                    'password': self.password
                }
            )
            response.raise_for_status()
            
            data = response.json()
            if data.get('success'):
                self.access_token = data['accessToken']
                self.refresh_token = data['refreshToken']
                
                # Decode token expiry (simplified)
                import base64
                payload = json.loads(
                    base64.b64decode(
                        self.access_token.split('.')[1] + '=='
                    ).decode('utf-8')
                )
                self.token_expiry = datetime.fromtimestamp(payload['exp'])
                
                # Set default authorization header
                self.session.headers.update({
                    'Authorization': f'Bearer {self.access_token}'
                })
                
                return True
            else:
                raise Exception(data.get('error', {}).get('message', 'Authentication failed'))
                
        except Exception as e:
            raise Exception(f'Authentication failed: {str(e)}')
    
    def refresh_access_token(self) -> bool:
        """Refresh the access token using refresh token."""
        if not self.refresh_token:
            raise Exception('No refresh token available')
        
        try:
            response = self.session.post(
                f'{self.base_url}/auth/refresh',
                json={'refreshToken': self.refresh_token}
            )
            response.raise_for_status()
            
            data = response.json()
            if data.get('success'):
                self.access_token = data['accessToken']
                self.refresh_token = data['refreshToken']
                
                # Update token expiry
                import base64
                payload = json.loads(
                    base64.b64decode(
                        self.access_token.split('.')[1] + '=='
                    ).decode('utf-8')
                )
                self.token_expiry = datetime.fromtimestamp(payload['exp'])
                
                # Update authorization header
                self.session.headers.update({
                    'Authorization': f'Bearer {self.access_token}'
                })
                
                return True
            else:
                raise Exception('Token refresh failed')
                
        except Exception as e:
            self.access_token = None
            self.refresh_token = None
            self.token_expiry = None
            self.session.headers.pop('Authorization', None)
            raise e
    
    def ensure_valid_token(self):
        """Ensure we have a valid access token."""
        if not self.access_token:
            self.authenticate()
            return
        
        # Check if token is about to expire (5 minutes buffer)
        if self.token_expiry:
            buffer_time = timedelta(minutes=5)
            if datetime.now() + buffer_time >= self.token_expiry:
                try:
                    self.refresh_access_token()
                except Exception:
                    self.authenticate()
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make an authenticated request to the API."""
        self.ensure_valid_token()
        
        url = f'{self.base_url}{endpoint}'
        response = self.session.request(method, url, **kwargs)
        
        # Handle token expiry
        if response.status_code == 401:
            try:
                self.refresh_access_token()
                response = self.session.request(method, url, **kwargs)
            except Exception:
                self.authenticate()
                response = self.session.request(method, url, **kwargs)
        
        response.raise_for_status()
        return response.json()
    
    # API methods
    def get_visitors(self, filters: Dict[str, Any] = None) -> Dict[str, Any]:
        """Get visitors with optional filters."""
        params = filters or {}
        return self._make_request('GET', '/visitors', params=params)
    
    def create_visitor(self, visitor_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new visitor."""
        return self._make_request('POST', '/visitors', json=visitor_data)
    
    def update_visitor(self, visitor_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing visitor."""
        return self._make_request('PUT', f'/visitors/{visitor_id}', json=updates)
    
    def delete_visitor(self, visitor_id: str) -> Dict[str, Any]:
        """Delete a visitor."""
        return self._make_request('DELETE', f'/visitors/{visitor_id}')
    
    def sync_visitors(self, operations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Sync visitor operations."""
        return self._make_request('POST', '/visitors/bulk-sync', json={
            'operations': operations
        })
    
    def get_daily_analytics(self, date: str) -> Dict[str, Any]:
        """Get daily analytics for a specific date."""
        return self._make_request('GET', f'/analytics/daily/{date}')
    
    def get_monthly_analytics(self, year: int, month: int) -> Dict[str, Any]:
        """Get monthly analytics."""
        return self._make_request('GET', f'/analytics/monthly/{year}/{month}')
    
    def get_analytics_report(self, filters: Dict[str, Any] = None) -> Dict[str, Any]:
        """Get custom analytics report."""
        params = filters or {}
        return self._make_request('GET', '/analytics/report', params=params)

# Usage example
if __name__ == '__main__':
    client = VisitorManagementClient(
        email='service@example.com',
        password='service-password'
    )
    
    try:
        # Get all visitors
        visitors = client.get_visitors()
        print(f"Found {len(visitors.get('visitors', []))} visitors")
        
        # Create a new visitor
        new_visitor = client.create_visitor({
            'name': 'John Doe',
            'company': 'Example Corp',
            'email': 'john@example.com',
            'interests': ['technology'],
            'captureMethod': 'business_card',
            'capturedAt': datetime.now().isoformat()
        })
        print(f"Created visitor: {new_visitor}")
        
        # Get analytics
        today = datetime.now().strftime('%Y-%m-%d')
        analytics = client.get_daily_analytics(today)
        print(f"Today's analytics: {analytics}")
        
    except Exception as e:
        print(f"Error: {e}")
```

This comprehensive guide provides authentication implementation examples for all major platforms, ensuring secure and robust integration with the Visitor Management API across different technology stacks.