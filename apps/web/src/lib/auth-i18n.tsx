"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "es" | "en";

const STORAGE_KEY = "crm_lang";

const COPY = {
  es: {
    brand: "CRM",
    welcomeBack: "Bienvenido de nuevo",
    welcomeSubtitle: "Ingresa tu correo y contraseña para acceder a tu cuenta.",
    createAccount: "Crear cuenta",
    createSubtitle: "Completa tus datos para empezar a gestionar tu equipo.",
    forgotTitle: "¿Olvidaste tu contraseña?",
    forgotSubtitle: "Te enviaremos un enlace para restablecerla.",
    resetTitle: "Nueva contraseña",
    resetSubtitle: "Elige una contraseña segura para tu cuenta.",
    email: "Correo",
    password: "Contraseña",
    name: "Nombre",
    companyName: "Nombre de la empresa",
    rememberMe: "Recordarme",
    forgotPassword: "¿Olvidaste tu contraseña?",
    logIn: "Iniciar sesión",
    loggingIn: "Entrando…",
    register: "Crear cuenta",
    registering: "Creando cuenta…",
    sendLink: "Enviar enlace",
    sending: "Enviando…",
    savePassword: "Guardar",
    saving: "Guardando…",
    noAccount: "¿No tienes una cuenta?",
    registerNow: "Regístrate ahora.",
    haveAccount: "¿Ya tienes una cuenta?",
    loginNow: "Inicia sesión.",
    backToLogin: "Volver al inicio de sesión",
    forgotDone:
      "Si esa cuenta existe, te enviamos un correo con un enlace para restablecer la contraseña. Revisa tu bandeja de entrada.",
    emailPlaceholder: "tu@empresa.com",
    passwordPlaceholder: "••••••••",
    namePlaceholder: "Tu nombre",
    companyPlaceholder: "Mi empresa",
    newPasswordPlaceholder: "Nueva contraseña (mín. 8)",
    genericError: "Error",
    showPassword: "Mostrar contraseña",
    hidePassword: "Ocultar contraseña",
    loading: "Cargando…",
    marketingHeadline: "Gestiona tu equipo y operaciones sin esfuerzo.",
    marketingSub:
      "Inicia sesión para acceder a tu panel CRM y gestionar tu equipo.",
    totalSales: "Ventas totales",
    totalProfit: "Beneficio total",
    fromLastWeek: "vs. semana anterior",
    chartPerformance: "Rendimiento",
    fromLastMonth: "vs. mes anterior",
    salesOverview: "Resumen de ventas",
    weekly: "Semanal",
    salesCategories: "Categorías de venta",
    units: "Unidades",
    productTransaction: "Transacciones",
    productName: "Producto",
    orderDate: "Fecha",
    totalPrice: "Precio",
    status: "Estado",
    inTransit: "En tránsito",
    paid: "Pagado",
    dropshipping: "Dropshipping",
    laptops: "Portátiles",
    accessories: "Accesorios",
  },
  en: {
    brand: "CRM",
    welcomeBack: "Welcome Back",
    welcomeSubtitle: "Enter your email and password to access your account.",
    createAccount: "Create account",
    createSubtitle: "Fill in your details to start managing your team.",
    forgotTitle: "Forgot your password?",
    forgotSubtitle: "We'll send you a link to reset it.",
    resetTitle: "New password",
    resetSubtitle: "Choose a secure password for your account.",
    email: "Email",
    password: "Password",
    name: "Name",
    companyName: "Company name",
    rememberMe: "Remember Me",
    forgotPassword: "Forgot Your Password?",
    logIn: "Log In",
    loggingIn: "Signing in…",
    register: "Create account",
    registering: "Creating account…",
    sendLink: "Send link",
    sending: "Sending…",
    savePassword: "Save",
    saving: "Saving…",
    noAccount: "Don't have an account?",
    registerNow: "Register now.",
    haveAccount: "Already have an account?",
    loginNow: "Log in.",
    backToLogin: "Back to log in",
    forgotDone:
      "If that account exists, we sent an email with a link to reset your password. Check your inbox.",
    emailPlaceholder: "you@company.com",
    passwordPlaceholder: "••••••••",
    namePlaceholder: "Your name",
    companyPlaceholder: "My company",
    newPasswordPlaceholder: "New password (min. 8)",
    genericError: "Error",
    showPassword: "Show password",
    hidePassword: "Hide password",
    loading: "Loading…",
    marketingHeadline: "Effortlessly manage your team and operations.",
    marketingSub: "Log in to access your CRM dashboard and manage your team.",
    totalSales: "Total Sales",
    totalProfit: "Total Profit",
    fromLastWeek: "From last week",
    chartPerformance: "Chart Performance",
    fromLastMonth: "From last month",
    salesOverview: "Sales Overview",
    weekly: "Weekly",
    salesCategories: "Sales Categories",
    units: "Units",
    productTransaction: "Product Transaction",
    productName: "Product Name",
    orderDate: "Order Date",
    totalPrice: "Total Price",
    status: "Status",
    inTransit: "In Transit",
    paid: "Paid",
    dropshipping: "Dropshipping",
    laptops: "Laptops & PC",
    accessories: "Accessories",
  },
} as const;

const ERRORS: Record<Lang, Record<string, string>> = {
  es: {
    "Invalid credentials": "Correo o contraseña incorrectos",
    "Email already registered": "Este correo ya está registrado",
    "Invalid or expired token": "El enlace no es válido o expiró",
    "Request failed": "No se pudo completar la solicitud",
    "No organization": "No hay una organización asociada",
    Unauthorized: "No autorizado",
  },
  en: {
    "Invalid credentials": "Invalid email or password",
    "Email already registered": "This email is already registered",
    "Invalid or expired token": "This link is invalid or has expired",
    "Request failed": "Request failed",
    "No organization": "No organization is associated with this account",
    Unauthorized: "Unauthorized",
  },
};

export type AuthCopy = (typeof COPY)[Lang];

type AuthI18n = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: AuthCopy;
  translateError: (message: string) => string;
};

const AuthI18nContext = createContext<AuthI18n | null>(null);

export function AuthI18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "es") setLangState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<AuthI18n>(
    () => ({
      lang,
      setLang,
      t: COPY[lang],
      translateError: (message: string) =>
        ERRORS[lang][message] || message || COPY[lang].genericError,
    }),
    [lang, setLang],
  );

  return <AuthI18nContext.Provider value={value}>{children}</AuthI18nContext.Provider>;
}

export function useAuthI18n() {
  const ctx = useContext(AuthI18nContext);
  if (!ctx) throw new Error("useAuthI18n must be used within AuthI18nProvider");
  return ctx;
}
