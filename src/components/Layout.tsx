import React, { useState, useEffect } from 'react';
import { useNavigate, NavLink, Link, useLocation, useSearchParams } from 'react-router-dom';
import { 
  Menu, 
  X, 
  MapPin,
  ChevronDown,
  Ticket,
  Home as HomeIcon,
  Search,
  Heart,
  PlusCircle,
  Calendar,
  User,
  Music,
  Theater,
  Utensils,
  Star,
  Compass,
  Mic,
  SlidersHorizontal,
  Flame,
  MessageCircle,
  QrCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ROUTE_PATHS } from '@/lib';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Footer } from '@/components/Footer';
import { Notifications } from '@/components/Notifications';
import { ProfileMenu } from '@/components/ProfileMenu';
import { CreateEventModal } from '@/components/CreateEventModal';
import { AuthModal } from '@/components/AuthModal';
import { LocationPopup } from '@/components/LocationPopup';
import { FloatingChat } from '@/components/FloatingChat';
import { MatchPersistentToast } from '@/components/MatchPersistentToast';
import logoImage from '@/assets/logo-new.png';
import { Input } from '@/components/ui/input';
import { StateSelector } from '@/components/StateSelector';
import { BRAZIL_STATES } from '@/constants/states';
import { EmailConfirmationBanner } from '@/components/EmailConfirmationBanner';

interface LayoutProps {
  children: React.ReactNode;
  showTopBanner?: boolean;
  fullWidth?: boolean;
}

export function Layout({ children, showTopBanner = false, fullWidth = false }: LayoutProps) {
  const { user, profile } = useAuth();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentQuery = searchParams.get("q") || "";
  const [searchTerm, setSearchTerm] = useState(currentQuery);

  const roles = profile?.roles || [];
  const isOrganizerApproved = roles.includes('ORGANIZER') && profile?.organizer_status === 'APPROVED';
  const isStaff = roles.includes('STAFF');
  const canUseScanner = isOrganizerApproved || isStaff;

  // Sync internal state with URL params
  useEffect(() => {
    setSearchTerm(currentQuery);
  }, [currentQuery]);

  // Handle Search Submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    
    if (searchTerm.trim()) {
      params.set("q", searchTerm);
    } else {
      params.delete("q");
    }

    // Always navigate to ExploreEvents with preserved params
    navigate(`${ROUTE_PATHS.EXPLORE}?${params.toString()}`);
  };

  const categories = [
    { name: "Festas e shows", icon: Music },
    { name: "Teatros e espetáculos", icon: Theater },
    { name: "Congressos e palestras", icon: Mic },
    { name: "Passeios e tours", icon: Compass },
    { name: "Gastronomia", icon: Utensils },
    { name: "Grátis", icon: Star }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/30 selection:text-primary font-sans">
      <EmailConfirmationBanner />
      
      {/* Top Banner */}
      {showTopBanner && (
        <div className="bg-[#1F222A] text-white py-2 px-4 flex md:hidden justify-between items-center text-sm z-50 relative">
          <div className="flex items-center gap-4">
            <span className="font-bold">É Produtor?</span>
            <CreateEventModal 
              trigger={
                <button className="border border-white rounded px-4 py-1 hover:bg-white/10 transition-colors font-medium text-xs uppercase tracking-wide">
                  Criar evento
                </button>
              }
            />
          </div>
        </div>
      )}

      {/* MOBILE TOP BAR (Search & Filters) */}
      <div className="md:hidden sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100 pb-2">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to={ROUTE_PATHS.HOME} className="flex-shrink-0">
            <img 
              src={logoImage} 
              alt="Pré-fest" 
              className="h-12 w-auto object-contain" 
            />
          </Link>
          <div className="flex items-center gap-2">
            <div className="scale-90 origin-right">
              <StateSelector />
            </div>

            {user && canUseScanner && (
              <button
                onClick={() => navigate(ROUTE_PATHS.ORGANIZER_SCANNER)}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-white shadow-sm active:scale-95 transition-transform"
                aria-label="Ler QR Code"
              >
                <QrCode size={18} />
              </button>
            )}

            {user && (
              <div className="flex-shrink-0">
                <Notifications />
              </div>
            )}

            {user ? (
              <Link to="/perfil" className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 border border-gray-200 overflow-hidden ml-1">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Perfil" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    <User size={16} />
                  </div>
                )}
              </Link>
            ) : (
              <AuthModal 
                trigger={
                  <button className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 ml-1">
                    <User size={16} />
                  </button>
                }
              />
            )}
          </div>
        </div>
        
        <div className="px-4 pb-2 flex gap-3">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input 
              placeholder="Buscar experiências..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors w-full"
            />
          </form>
          <button 
            onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg border transition-colors",
              isMobileFiltersOpen ? "bg-primary text-white border-primary" : "bg-white border-gray-200 text-gray-600"
            )}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {/* Mobile Filters (Categories) */}
        <AnimatePresence>
          {isMobileFiltersOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
                {categories.map((cat) => (
                  <Link
                    key={cat.name}
                    to={`/explorar-eventos?category=${encodeURIComponent(cat.name)}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs font-medium text-gray-600 whitespace-nowrap active:scale-95 transition-transform"
                  >
                    <cat.icon size={12} />
                    {cat.name}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* DESKTOP Header - Hidden on Mobile */}
      <header className="hidden md:block sticky top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-100">
        <div className="container max-w-7xl mx-auto px-4 h-20 flex items-center justify-between gap-8">
          
          {/* Left Section: Logo & Search & Location */}
          <div className="flex items-center gap-8 flex-1">
            {/* Logo */}
            <Link to={ROUTE_PATHS.HOME} className="flex-shrink-0">
              <img 
                src={logoImage} 
                alt="Pré-fest" 
                className="h-16 w-auto object-contain" 
              />
            </Link>

            {/* Desktop Search Bar & Location */}
            <div className="flex items-center flex-1 relative shadow-sm hover:shadow-md transition-shadow rounded-lg">
              <form onSubmit={handleSearch} className="relative flex-1 group z-10">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input 
                  placeholder="Buscar experiências" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-12 bg-white border-gray-200 focus-visible:ring-0 focus-visible:border-primary rounded-l-lg rounded-r-none border-r-0 shadow-none hover:border-gray-300 transition-colors focus:z-20 w-full"
                />
              </form>

              {/* Location Selector (Desktop) */}
              <div className="relative z-0">
                <StateSelector />
              </div>
            </div>
          </div>

          {/* Right Section: Actions */}
          <div className="flex items-center gap-6 flex-shrink-0">
            <div className="flex items-center gap-6 text-sm font-medium text-gray-600">
              <CreateEventModal 
                trigger={
                  <button className="flex items-center gap-2 hover:text-primary transition-colors">
                    <PlusCircle size={18} />
                    <span>Criar evento</span>
                  </button>
                }
              />
              
              {user && (
                <Link to="/meus-eventos" className="hidden md:inline-flex items-center gap-2 hover:text-primary transition-colors">
                  <Calendar size={18} />
                  <span>Meus eventos</span>
                </Link>
              )}
            </div>

            {/* User Profile / Auth */}
            <div className="flex items-center gap-4">
              {user && (
                <>
                  <Notifications />
                  {canUseScanner && (
                    <button
                      onClick={() => navigate(ROUTE_PATHS.ORGANIZER_SCANNER)}
                      className="hidden lg:inline-flex items-center gap-2 px-3 py-2 rounded-full border border-primary/20 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
                    >
                      <QrCode size={16} />
                      <span>Scanner</span>
                    </button>
                  )}
                </>
              )}
              {user ? (
                <ProfileMenu />
              ) : (
                <AuthModal 
                  trigger={
                    <button className="flex items-center gap-2 text-gray-600 hover:text-primary font-medium">
                      <User size={20} />
                      <span>Entrar</span>
                    </button>
                  }
                />
              )}
            </div>
          </div>
        </div>

        {/* Category Navigation Bar (Desktop) */}
        <div className="bg-primary text-white shadow-md relative z-10">
          <div className="container max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-center gap-8 py-3 text-sm font-medium overflow-x-auto scrollbar-hide">
              {categories.map((cat) => (
                <Link  
                  key={cat.name} 
                  to={`/explorar-eventos?category=${encodeURIComponent(cat.name)}`} 
                  className="whitespace-nowrap hover:text-white/80 transition-colors relative group py-1 flex items-center gap-2"
                >
                  <cat.icon size={16} className="text-white/70 group-hover:text-white transition-colors" />
                  <span>{cat.name}</span>
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-white transition-all duration-300 group-hover:w-full"></span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className={cn(
        "flex-1 w-full",
        !fullWidth && "container max-w-7xl mx-auto px-4 py-8",
        "mb-20 md:mb-0" // Add bottom margin on mobile for fixed nav
      )}>
        {children}
      </main>

      {/* MOBILE BOTTOM NAV */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 px-6 py-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between">
          <NavLink 
            to={ROUTE_PATHS.HOME} 
            className={({isActive}) => cn(
              "flex flex-col items-center gap-1 transition-colors",
              isActive ? "text-primary" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <HomeIcon size={24} />
            <span className="text-[10px] font-medium">Início</span>
          </NavLink>

          <NavLink 
            to={ROUTE_PATHS.EM_ALTA} 
            className={({isActive}) => cn(
              "flex flex-col items-center gap-1 transition-colors",
              isActive ? "text-primary" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <Compass size={24} />
            <span className="text-[10px] font-medium">Descobrir</span>
          </NavLink>

          {user ? (
            <div className="-mt-8 relative group">
              <NavLink 
                to="/m/chat" 
                className={({isActive}) => cn(
                  "flex items-center justify-center w-16 h-16 rounded-full border-4 border-white shadow-xl transition-all duration-300 bg-primary text-white",
                  isActive 
                    ? "scale-110 shadow-primary/50" 
                    : "hover:bg-primary/90 hover:scale-105"
                )}
              >
                {({ isActive }) => (
                  <Flame 
                    size={32} 
                    className={cn(
                      "transition-all duration-300 fill-white",
                      isActive ? "animate-pulse" : ""
                    )} 
                    strokeWidth={isActive ? 0 : 2}
                  />
                )}
              </NavLink>
            </div>
          ) : (
            <div className="-mt-8 relative">
              <AuthModal 
                trigger={
                  <button className="flex items-center justify-center w-16 h-16 rounded-full border-4 border-white shadow-xl bg-primary text-white hover:bg-primary/90 transition-all duration-300 hover:scale-105">
                    <Flame size={32} className="fill-white" strokeWidth={2} />
                  </button>
                }
              />
            </div>
          )}

          <NavLink 
            to={ROUTE_PATHS.MY_EVENTS} 
            className={({isActive}) => cn(
              "flex flex-col items-center gap-1 transition-colors",
              isActive ? "text-primary" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <Ticket size={24} />
            <span className="text-[10px] font-medium">Ingressos</span>
          </NavLink>

          {user ? (
            <NavLink 
              to="/m/chat" 
              className={({isActive}) => cn(
                "flex flex-col items-center gap-1 transition-colors",
                isActive ? "text-primary" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <MessageCircle size={24} />
              <span className="text-[10px] font-medium">Chat</span>
            </NavLink>
          ) : (
            <AuthModal 
              trigger={
                <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600">
                  <MessageCircle size={24} />
                  <span className="text-[10px] font-medium">Chat</span>
                </button>
              }
            />
          )}
        </div>
      </div>

      <Footer />
      
      {/* Location Popup - Global Floating Notification */}
      <LocationPopup />
      <FloatingChat />
      <MatchPersistentToast />
    </div>
  );
}
