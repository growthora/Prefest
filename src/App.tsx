import React, { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation, useNavigate } from "react-router-dom";
import { ROUTE_PATHS, buildEventDetailsPath } from "@/lib/index";
import { AuthProvider } from "@/contexts/AuthContext";
import { ConfirmProvider } from "@/contexts/ConfirmContext";
import { useAuth } from "@/hooks/useAuth";
import { GlobalLoader } from "@/components/GlobalLoader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
const Home = lazy(() => import("./pages/Home"));
const ExploreEvents = lazy(() => import("./pages/ExploreEvents"));
const Collection = lazy(() => import("./pages/Collection"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const SellTickets = lazy(() => import("./pages/SellTickets"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const MyEvents = lazy(() => import("./pages/MyEvents"));
const TicketDetails = lazy(() => import("./pages/TicketDetails"));
const EventMatches = lazy(() => import("./pages/EventMatches"));
const EventDetails = lazy(() => import("./pages/EventDetails"));
const Profile = lazy(() => import("./pages/Profile"));
const DeletarConta = lazy(() => import("./pages/DeletarConta"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const Chat = lazy(() => import("./pages/Chat"));
const ChatMobile = lazy(() => import("./pages/mobile/ChatMobile"));
const TicketScanner = lazy(() => import("./pages/TicketScanner"));
const DebugAuth = lazy(() => import("./pages/DebugAuth"));
// const AdminRoute = lazy(() => import("@/components/AdminRoute")); // Replaced by ProtectedRoute
const AdminLayout = lazy(() => import("@/components/dashboard/AdminLayout"));
const AdminOverview = lazy(() => import("@/pages/admin/AdminOverview"));
const AdminEvents = lazy(() => import("@/pages/admin/AdminEvents"));
const AdminCoupons = lazy(() => import("@/pages/admin/AdminCoupons"));
const AdminRequests = lazy(() => import("@/pages/admin/AdminRequests"));
const AdminOrganizers = lazy(() => import("@/pages/admin/AdminOrganizers"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminFinancial = lazy(() => import("@/pages/admin/AdminFinancial"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));
const AdminSupport = lazy(() => import("@/pages/admin/AdminSupport"));
const AdminStats = lazy(() => import("@/pages/admin/AdminStats"));
const SupportHub = lazy(() => import("./pages/Support/SupportHub"));
const HelpCenter = lazy(() => import("./pages/Support/HelpCenter"));
const ContactUs = lazy(() => import("./pages/Support/ContactUs"));
const FAQ = lazy(() => import("./pages/Support/FAQ"));
const LoginForm = lazy(() =>
  import("@/components/LoginForm").then((module) => ({ default: module.LoginForm })),
);
const ForgotPassword = lazy(() =>
  import("@/pages/Auth/ForgotPassword").then((module) => ({ default: module.ForgotPassword })),
);
const ResetPassword = lazy(() =>
  import("@/pages/Auth/ResetPassword").then((module) => ({ default: module.ResetPassword })),
);
const AuthError = lazy(() =>
  import("@/pages/Auth/AuthError").then((module) => ({ default: module.AuthError })),
);
const CreateEventForm = lazy(() =>
  import("@/components/CreateEventForm").then((module) => ({ default: module.CreateEventForm })),
);
const EventList = lazy(() =>
  import("@/components/EventList").then((module) => ({ default: module.EventList })),
);
// const OrganizerRoute = lazy(() => import("@/components/OrganizerRoute")); // Replaced by ProtectedRoute
const ProtectedRoute = lazy(() => import("@/components/ProtectedRoute"));
const DashboardLayout = lazy(() => import("@/components/dashboard/DashboardLayout"));
const Overview = lazy(() => import("@/pages/dashboard/Overview"));
const OrganizerEvents = lazy(() => import("@/pages/dashboard/OrganizerEvents"));
const Sales = lazy(() => import("@/pages/dashboard/Sales"));
const Participants = lazy(() => import("@/pages/dashboard/Participants"));
const Payments = lazy(() => import("@/pages/dashboard/Payments"));
const Settings = lazy(() => import("@/pages/dashboard/Settings"));
const Scanner = lazy(() => import("@/pages/dashboard/organizer/Scanner"));
const CompleteProfile = lazy(() => import("@/pages/CompleteProfile"));
const NotFound = lazy(() => import("./pages/not-found/Index"));
import { NotificationManager } from "@/components/NotificationManager";
import { ScrollToTop } from "@/components/ScrollToTop";
import { useIsMobile } from "@/hooks/use-mobile";
const EmAlta = lazy(() => import("./pages/EmAlta"));
const Categorias = lazy(() => import("./pages/Categorias"));
const Novidades = lazy(() => import("./pages/Novidades"));
const StatusPage = lazy(() => import("./pages/Status"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Always revalidate against DB/API to avoid stale frontend state.
      staleTime: 0,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

const RedirectToEventDetails = () => {
  const { slug } = useParams();
  const safeSlug = typeof slug === "string" ? slug : "";
  return <Navigate to={buildEventDetailsPath(safeSlug)} replace />;
};

const ChatDesktopRoute = () => {
  const isMobile = useIsMobile();
  const { matchId } = useParams();

  if (isMobile) {
    const target = matchId ? `/m/chat/${matchId}` : "/m/chat";
    return <Navigate to={target} replace />;
  }

  return <Chat />;
};

const ChatMobileRoute = () => {
  const isMobile = useIsMobile();
  const { matchId } = useParams();

  if (!isMobile) {
    const target = matchId ? `/chat/${matchId}` : "/chat";
    return <Navigate to={target} replace />;
  }

  return <ChatMobile />;
};

const AppRoutes = () => {
  const { authStatus, isRecoveryMode } = useAuth();
  const location = useLocation();

  if (authStatus === 'checking') {
    return <GlobalLoader />;
  }

  // Global Recovery Mode Guard
  // If in recovery mode, user MUST stay on /reset-password or /auth/error
  // Any other route access is blocked and redirected
  if (isRecoveryMode) {
    const allowedPaths = [ROUTE_PATHS.UPDATE_PASSWORD, ROUTE_PATHS.AUTH_ERROR];
    // Check if current path starts with allowed paths (to handle query params or sub-routes if any)
    // Actually exact match or base path match is safer.
    const isAllowed = allowedPaths.some(path => location.pathname === path);
    
    if (!isAllowed) {
      return <Navigate to={ROUTE_PATHS.UPDATE_PASSWORD} replace />;
    }
  }

  return (
    <>
      <NotificationManager />
      <Routes>
        <Route path={ROUTE_PATHS.LOGIN} element={<LoginForm />} />
      <Route path={ROUTE_PATHS.FORGOT_PASSWORD} element={<ForgotPassword />} />
      <Route path={ROUTE_PATHS.UPDATE_PASSWORD} element={<ResetPassword />} />
      <Route path={ROUTE_PATHS.AUTH_ERROR} element={<AuthError />} />
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="eventos" element={<AdminEvents />} />
          <Route path="cupons" element={<AdminCoupons />} />
          <Route path="solicitacoes" element={<AdminRequests />} />
          <Route path="organizadores" element={<AdminOrganizers />} />
          <Route path="usuarios" element={<AdminUsers />} />
          <Route path="financeiro" element={<AdminFinancial />} />
          <Route path="configuracoes" element={<AdminSettings />} />
          <Route path="suporte" element={<AdminSupport />} />
          <Route path="estatisticas" element={<AdminStats />} />
        </Route>
      </Route>
      {/* <Route path={ROUTE_PATHS.TICKET_SCANNER} element={<TicketScanner />} /> Moved to ProtectedRoute */}
      <Route path={ROUTE_PATHS.HOME} element={<Home />} />
      <Route path={ROUTE_PATHS.EXPLORE} element={<ExploreEvents />} />
      <Route path={ROUTE_PATHS.EM_ALTA} element={<EmAlta />} />
      <Route path={ROUTE_PATHS.CATEGORIES} element={<Categorias />} />
      <Route path={ROUTE_PATHS.NEWS} element={<Novidades />} />
      <Route path={ROUTE_PATHS.COLLECTION} element={<Collection />} />
      <Route path={ROUTE_PATHS.HOW_IT_WORKS} element={<HowItWorks />} />
      <Route path={ROUTE_PATHS.SELL_TICKETS} element={<SellTickets />} />
      <Route path={ROUTE_PATHS.PRIVACY} element={<PrivacyPolicy />} />
      <Route path={ROUTE_PATHS.TERMS} element={<TermsOfUse />} />
      <Route path={ROUTE_PATHS.STATUS} element={<StatusPage />} />
      <Route path={ROUTE_PATHS.SUPPORT} element={<SupportHub />} />
      <Route
        path={ROUTE_PATHS.HELP_CENTER}
        element={<Navigate to={ROUTE_PATHS.FAQ} replace />}
      />
      <Route path={ROUTE_PATHS.CONTACT_US} element={<ContactUs />} />
      <Route path={ROUTE_PATHS.FAQ} element={<FAQ />} />
      <Route path={ROUTE_PATHS.EVENTS} element={<EventList />} />
      <Route path={ROUTE_PATHS.EVENT_DETAILS} element={<EventDetails />} />
      <Route path={ROUTE_PATHS.PUBLIC_PROFILE} element={<PublicProfile />} />
      <Route path="/perfil/completar-cadastro" element={<CompleteProfile />} />
      <Route path="/debug-auth" element={<DebugAuth />} />
      
      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path={ROUTE_PATHS.CREATE_EVENT} element={<CreateEventForm />} />
        <Route path={ROUTE_PATHS.MY_EVENTS} element={<MyEvents />} />
        <Route path="/ingressos/:ticketId" element={<TicketDetails />} />
        <Route path="/eventos/:eventId/matchs" element={<EventMatches />} />
        <Route path={ROUTE_PATHS.PROFILE} element={<Profile />} />
        <Route path={ROUTE_PATHS.DELETE_ACCOUNT} element={<DeletarConta />} />
        <Route path={ROUTE_PATHS.TICKET_SCANNER} element={<TicketScanner />} />
        
        {/* Chat Routes */}
        <Route path="/chat" element={<ChatDesktopRoute />} />
        <Route path={ROUTE_PATHS.CHAT} element={<ChatDesktopRoute />} />
        <Route path="/m/chat" element={<ChatMobileRoute />} />
        <Route path="/m/chat/:matchId" element={<ChatMobileRoute />} />
      </Route>

      {/* Redirects for old routes */}
      <Route path="/profile" element={<Navigate to={ROUTE_PATHS.PROFILE} replace />} />
      <Route path="/my-events" element={<Navigate to={ROUTE_PATHS.MY_EVENTS} replace />} />
      <Route path="/create-event" element={<Navigate to={ROUTE_PATHS.CREATE_EVENT} replace />} />
      <Route path="/events" element={<Navigate to={ROUTE_PATHS.EVENTS} replace />} />
      <Route path="/forgot-password" element={<Navigate to={ROUTE_PATHS.FORGOT_PASSWORD} replace />} />
      <Route path="/update-password" element={<Navigate to={ROUTE_PATHS.UPDATE_PASSWORD} replace />} />
      <Route path="/evento/:slug" element={<RedirectToEventDetails />} />

      {/* Organizer Dashboard Routes */}
      <Route element={<ProtectedRoute requireOrganizerApproved={true} />}>
        <Route path={ROUTE_PATHS.ORGANIZER_DASHBOARD} element={<DashboardLayout />}>
          <Route index element={<Overview />} />
          <Route path="eventos" element={<OrganizerEvents />} />
          <Route path="vendas" element={<Sales />} />
          <Route path="participantes" element={<Participants />} />
          <Route path="pagamentos" element={<Payments />} />
          <Route path="configuracoes" element={<Settings />} />
          <Route path="scanner" element={<Scanner />} />
        </Route>
      </Route>
      
      <Route path="*" element={<NotFound />} />
    </Routes>
    </>
  );
};

// Interceptor for Supabase Auth Errors (Hash Fragment)
const AuthErrorInterceptor = () => {
  const { hash } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (hash && (hash.includes('error=') || hash.includes('error_code='))) {
      // Remove the leading #
      const params = new URLSearchParams(hash.substring(1));
      
      const error = params.get('error');
      const errorCode = params.get('error_code');
      const errorDescription = params.get('error_description');

      if (error || errorCode) {
        // Construct query string for the error page
        const searchParams = new URLSearchParams();
        if (error) searchParams.set('error', error);
        if (errorCode) searchParams.set('error_code', errorCode);
        if (errorDescription) searchParams.set('error_description', errorDescription);

        // Redirect to /auth/error with params
        navigate(`${ROUTE_PATHS.AUTH_ERROR}?${searchParams.toString()}`, { replace: true });
      }
    }
  }, [hash, navigate]);

  return null;
};

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ConfirmProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner position="top-center" richColors />
              <BrowserRouter>
                <AuthErrorInterceptor />
                <ScrollToTop />
                <Suspense fallback={<GlobalLoader />}>
                  <AppRoutes />
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </ConfirmProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;




