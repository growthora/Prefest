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
  Info,
  Heart,
  PlusCircle,
  Calendar,
  User,
  Music,
  Theater,
  Utensils,
  Star,
  Compass,
  Mic
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ROUTE_PATHS } from '@/lib';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Footer } from '@/components/Footer';
import { Notifications } from '@/components/Notifications';
import { FloatingChat } from '@/components/FloatingChat';
import { ProfileMenu } from '@/components/ProfileMenu';
import { CreateEventModal } from '@/components/CreateEventModal';
import { AuthModal } from '@/components/AuthModal';
import { LocationPopup } from '@/components/LocationPopup';
import logoImage from '@/assets/PHOTO-2026-02-02-13-32-10_-_cópia-removebg-preview.png';
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const currentStateValue = searchParams.get("state");
  const currentQuery = searchParams.get("q") || "";
  const currentLocation = BRAZIL_STATES.find(s => s.value === currentStateValue)?.label || 'Qualquer lugar';

  const [searchTerm, setSearchTerm] = useState(currentQuery);

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

  // Close mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { name: 'Início', path: ROUTE_PATHS.HOME, icon: HomeIcon },
    { name: 'Explorar', path: ROUTE_PATHS.EXPLORE, icon: Search },
    { name: 'Como Funciona', path: ROUTE_PATHS.HOW_IT_WORKS, icon: Info },
  ];

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

      {/* Main Header - White on Desktop to match Sympla */}
      <header className="sticky top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-100">
        <div className="container max-w-7xl mx-auto px-4 h-20 flex items-center justify-between gap-8">
          
          {/* Left Section: Logo & Search & Location */}
          <div className="flex items-center gap-8 flex-1">
            {/* Logo */}
            <Link to={ROUTE_PATHS.HOME} className="flex-shrink-0">
              <img 
                src={logoImage} 
                alt="Pré-fest" 
                className="h-10 w-auto object-contain" 
              />
            </Link>

            {/* Desktop Search Bar & Location */}
            <div className="hidden md:flex items-center flex-1 relative shadow-sm hover:shadow-md transition-shadow rounded-lg">
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
            
            {/* Desktop Action Links */}
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
              <CreateEventModal 
                trigger={
                  <button className="flex items-center gap-2 hover:text-primary transition-colors">
                    <PlusCircle size={18} />
                    <span>Criar evento</span>
                  </button>
                }
              />
              
              {user && (
                <>
                  <Link to="/meus-eventos" className="flex items-center gap-2 hover:text-primary transition-colors">
                    <Calendar size={18} />
                    <span>Meus eventos</span>
                  </Link>
                </>
              )}
            </div>

            {/* User Profile / Auth */}
            <div className="hidden md:block">
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

            {/* Mobile/Menu Toggle */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-600 md:hidden p-1"
            >
              {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>

        {/* Category Navigation Bar (Desktop) */}
        <div className="hidden md:block bg-primary text-white shadow-md relative z-10">
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

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: "tween", duration: 0.3 }}
            className="fixed inset-0 z-40 bg-background pt-20 px-6 shadow-2xl"
          >
            <div className="flex flex-col gap-6">
              
              {/* Mobile Location Selector */}
              <div className="flex items-center gap-2 text-primary pb-4 border-b border-border/10">
                <MapPin size={20} />
                <span className="font-medium text-lg">{currentLocation}</span>
                <ChevronDown size={18} />
              </div>

              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="text-xl font-medium text-foreground/80 hover:text-primary transition-colors py-2"
                >
                  {link.name}
                </Link>
              ))}

              <hr className="border-border/10" />

              <div className="flex flex-col gap-4">
                 {user ? (
                    <ProfileMenu />
                 ) : (
                    <AuthModal 
                      trigger={
                        <button className="w-full py-3 rounded-lg border border-primary text-primary font-bold hover:bg-primary/5 transition-colors">
                          Entrar / Cadastrar
                        </button>
                      }
                    />
                 )}
                 
                 <CreateEventModal 
                    trigger={
                      <button className="w-full py-3 rounded-lg bg-primary text-white font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                        Criar evento
                      </button>
                    }
                  />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className={cn(
        "flex-1 w-full",
        !fullWidth && "container max-w-7xl mx-auto px-4 py-8"
      )}>
        {children}
      </main>

      <Footer />
      
      {/* Floating Chat */}
      {user && <FloatingChat />}
      
      {/* Location Popup - Global Floating Notification */}
      <LocationPopup />
    </div>
  );
}
