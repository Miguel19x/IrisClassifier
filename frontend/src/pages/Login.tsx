/**
 * Página de Inicio de Sesión/Registro.
 * 
 * Proporciona la interfaz de autenticación para usuarios.
 */
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import './Login.css';

export function LoginPage() {
    const { login, register } = useAuth();
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (isRegisterMode) {
                await register({ email, password });
            } else {
                await login({ email, password });
            }
        } catch (err: any) {
            const message = err.response?.data?.detail || err.message || 'Error de autenticación';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }

    function toggleMode() {
        setIsRegisterMode(!isRegisterMode);
        setError('');
    }

    return (
        <div className="login-page">
            <div className="login-background"></div>
            <div className="login-container">
                <div className="login-card">
                    <div className="login-header">
                        <h1>🌈 IrisClassifier</h1>
                        <p>Clasificación de Productos con IA</p>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        <h2>{isRegisterMode ? 'Crear Cuenta' : 'Bienvenido de Nuevo'}</h2>

                        {error && (
                            <div className="error-message">
                                ⚠️ {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="email">Correo Electrónico</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu@correo.com"
                                required
                                autoComplete="email"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Contraseña</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                                disabled={isLoading}
                                minLength={6}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className="loading-spinner">⏳ Cargando...</span>
                            ) : (
                                isRegisterMode ? 'Crear Cuenta' : 'Iniciar Sesión'
                            )}
                        </button>

                        <div className="form-footer">
                            <button
                                type="button"
                                onClick={toggleMode}
                                className="btn-toggle"
                                disabled={isLoading}
                            >
                                {isRegisterMode
                                    ? '¿Ya tienes cuenta? Inicia Sesión'
                                    : '¿No tienes cuenta? Regístrate'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
