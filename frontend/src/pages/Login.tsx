/**
 * Página de Inicio de Sesión/Registro.
 * 
 * Diseño premium con glassmorphism y animaciones.
 */
import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import heroBg from '@/assets/hero-bg.jpg';

export function LoginPage() {
    const { login, register } = useAuth();
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
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
        } catch (err: unknown) {
            const message = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
                || (err as Error)?.message
                || 'Error de autenticación';
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
        <div className="min-h-screen flex">
            {/* Left side - Hero image */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden animate-slide-left">
                <img
                    src={heroBg}
                    alt="IrisClassifier"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
                <div className="relative z-10 flex flex-col justify-center p-12">
                    <div className="animate-slide-up animation-delay-300 animation-fill-both">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
                                <span className="text-primary-foreground font-display font-bold text-2xl">IC</span>
                            </div>
                            <div>
                                <h1 className="font-display text-3xl font-bold text-foreground">IrisClassifier</h1>
                                <p className="text-muted-foreground">Clasificación de Productos con IA</p>
                            </div>
                        </div>
                        <h2 className="font-display text-4xl font-bold text-foreground mb-4 leading-tight">
                            Gestiona tus catálogos de{" "}
                            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                                manera inteligente
                            </span>
                        </h2>
                        <p className="text-lg text-muted-foreground max-w-md">
                            Sube catálogos de proveedores, extrae productos automáticamente con IA, compara precios
                            y genera listados optimizados para tus clientes.
                        </p>
                    </div>

                    <div className="mt-12 grid grid-cols-2 gap-4 animate-slide-up animation-delay-500 animation-fill-both">
                        {[
                            { label: "Extracción con IA", desc: "Procesamiento automático" },
                            { label: "Comparación", desc: "Entre proveedores" },
                            { label: "Multi-formato", desc: "PDF, Excel, Fotos" },
                            { label: "Exportación", desc: "PDF y Excel" },
                        ].map((feature) => (
                            <div
                                key={feature.label}
                                className="p-4 rounded-xl bg-card/30 backdrop-blur-sm border border-border/30"
                            >
                                <Sparkles className="h-5 w-5 text-primary mb-2" />
                                <p className="font-medium text-foreground">{feature.label}</p>
                                <p className="text-sm text-muted-foreground">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right side - Form */}
            <div className="flex-1 flex items-center justify-center p-6 bg-background animate-fade-in">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden text-center mb-8 animate-slide-down">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow mx-auto mb-4">
                            <span className="text-primary-foreground font-display font-bold text-3xl">IC</span>
                        </div>
                        <h1 className="font-display text-2xl font-bold text-foreground">IrisClassifier</h1>
                        <p className="text-muted-foreground">Clasificación de Productos con IA</p>
                    </div>

                    <Card variant="glass" className="p-8">
                        <div className="animate-slide-up animation-delay-200 animation-fill-both">
                            <div className="text-center mb-8">
                                <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                                    {isRegisterMode ? "Crear cuenta" : "Bienvenido de nuevo"}
                                </h2>
                                <p className="text-muted-foreground">
                                    {isRegisterMode
                                        ? "Completa los datos para registrarte"
                                        : "Ingresa tus credenciales para continuar"}
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Correo electrónico</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                        <Input
                                            type="email"
                                            placeholder="tu@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="pl-10"
                                            required
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Contraseña</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                        <Input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="pl-10 pr-10"
                                            required
                                            minLength={6}
                                            disabled={isLoading}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </button>
                                    </div>
                                </div>

                                {error && (
                                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm animate-slide-down">
                                        {error}
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    variant="premium"
                                    size="lg"
                                    className="w-full"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Procesando...
                                        </>
                                    ) : isRegisterMode ? (
                                        "Crear Cuenta"
                                    ) : (
                                        "Iniciar Sesión"
                                    )}
                                </Button>
                            </form>

                            <div className="mt-6 text-center">
                                <button
                                    type="button"
                                    onClick={toggleMode}
                                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                                    disabled={isLoading}
                                >
                                    {isRegisterMode ? (
                                        <>
                                            ¿Ya tienes cuenta?{" "}
                                            <span className="text-primary font-medium">Inicia Sesión</span>
                                        </>
                                    ) : (
                                        <>
                                            ¿No tienes cuenta?{" "}
                                            <span className="text-primary font-medium">Regístrate</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
