import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { ROUTE_PATHS, buildEventDetailsPath } from "@/lib/index";
import { AuthProvider } from "@/contexts/AuthContext";
import { ConfirmProvider } from "@/contexts/ConfirmContext";
import { useAuth } from "@/hooks/useAuth";
import { GlobalLoader } from "@/components/GlobalLoader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoginForm } from "@/components/LoginForm";
import { ForgotPassword } from "@/pages/Auth/ForgotPassword";
import { UpdatePassword } from "@/pages/Auth/UpdatePassword";
import { CreateEventForm } from "@/components/CreateEventForm";
import { EventList } from "@/components/EventList";
const Home = lazy(() => import("./pages/Home"));
const ExploreEvents = lazy(() => import("./pages/ExploreEvents"));
const Collection = lazy(() => import("./pages/Collection"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const SellTickets = lazy(() => import("./pages/SellTickets"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const MyEvents = lazy(() => import("./pages/MyEvents"));
const EventDetails = lazy(() => import("./pages/EventDetails"));
const Profile = lazy(() => import("./pages/Profile"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const Chat = lazy(() => import("./pages/Chat"));
const ChatMobile = lazy(() => import("./pages/mobile/ChatMobile"));
const TicketScanner = lazy(() => import("./pages/TicketScanner"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const SupportHub = lazy(() => import("./pages/Support/SupportHub"));
const HelpCenter = lazy(() => import("./pages/Support/HelpCenter"));
const ContactUs = lazy(() => import("./pages/Support/ContactUs"));
const FAQ = lazy(() => import("./pages/Support/FAQ"));
const OrganizerRoute = lazy(() => import("@/components/OrganizerRoute"));
const DashboardLayout = lazy(() => import("@/components/dashboard/DashboardLayout"));
const Overview = lazy(() => import("@/pages/dashboard/Overview"));
const OrganizerEvents = lazy(() => import("@/pages/dashboard/OrganizerEvents"));
const Sales = lazy(() => import("@/pages/dashboard/Sales"));
const Participants = lazy(() => import("@/pages/dashboard/Participants"));
const Payments = lazy(() => import("@/pages/dashboard/Payments"));
const Settings = lazy(() => import("@/pages/dashboard/Settings"));
const Scanner = lazy(() => import("@/pages/dashboard/organizer/Scanner"));
const NotFound = lazy(() => import("./pages/not-found/Index"));
import { NotificationManager } from "@/components/NotificationManager";
import { ScrollToTop } from "@/components/ScrollToTop";
import { useIsMobile } from "@/hooks/use-mobile";
import EmAlta from "./pages/EmAlta";
import Categorias from "./pages/Categorias";
import Novidades from "./pages/Novidades";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
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
  const { authStatus } = useAuth();

  if (authStatus === 'checking') {
    return <GlobalLoader />;
  }

  return (
    <>
      <NotificationManager />
      <Routes>
        <Route path={ROUTE_PATHS.LOGIN} element={<LoginForm />} />
      <Route path={ROUTE_PATHS.FORGOT_PASSWORD} element={<ForgotPassword />} />
      <Route path={ROUTE_PATHS.UPDATE_PASSWORD} element={<UpdatePassword />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path={ROUTE_PATHS.TICKET_SCANNER} element={<TicketScanner />} />
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
      <Route path={ROUTE_PATHS.SUPPORT} element={<SupportHub />} />
      <Route
        path={ROUTE_PATHS.HELP_CENTER}
        element={<Navigate to={ROUTE_PATHS.FAQ} replace />}
      />
      <Route path={ROUTE_PATHS.CONTACT_US} element={<ContactUs />} />
      <Route path={ROUTE_PATHS.FAQ} element={<FAQ />} />
      <Route path={ROUTE_PATHS.EVENTS} element={<EventList />} />
      <Route path={ROUTE_PATHS.CREATE_EVENT} element={<CreateEventForm />} />
      <Route path={ROUTE_PATHS.MY_EVENTS} element={<MyEvents />} />
      <Route path={ROUTE_PATHS.EVENT_DETAILS} element={<EventDetails />} />
      <Route path={ROUTE_PATHS.PROFILE} element={<Profile />} />
      <Route path={ROUTE_PATHS.PUBLIC_PROFILE} element={<PublicProfile />} />
      <Route path="/chat" element={<ChatDesktopRoute />} />
      <Route path={ROUTE_PATHS.CHAT} element={<ChatDesktopRoute />} />
      <Route path="/m/chat" element={<ChatMobileRoute />} />
      <Route path="/m/chat/:matchId" element={<ChatMobileRoute />} />

      {/* Redirects for old routes */}
      <Route path="/profile" element={<Navigate to={ROUTE_PATHS.PROFILE} replace />} />
      <Route path="/my-events" element={<Navigate to={ROUTE_PATHS.MY_EVENTS} replace />} />
      <Route path="/create-event" element={<Navigate to={ROUTE_PATHS.CREATE_EVENT} replace />} />
      <Route path="/events" element={<Navigate to={ROUTE_PATHS.EVENTS} replace />} />
      <Route path="/forgot-password" element={<Navigate to={ROUTE_PATHS.FORGOT_PASSWORD} replace />} />
      <Route path="/update-password" element={<Navigate to={ROUTE_PATHS.UPDATE_PASSWORD} replace />} />
      <Route path="/evento/:slug" element={<RedirectToEventDetails />} />

      {/* Organizer Dashboard Routes */}
      <Route element={<OrganizerRoute />}>
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

const App = () => {
  console.log('🚀 App iniciando...');
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ConfirmProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner position="top-center" richColors />
              <BrowserRouter>
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
