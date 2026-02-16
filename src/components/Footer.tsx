import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Instagram, 
  Twitter, 
  Facebook, 
  Mail, 
  ArrowRight,
  Linkedin
} from 'lucide-react';
import { ROUTE_PATHS } from '@/lib';
import logoImage from '@/assets/logo-new.png';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    discover: [
      { label: 'Explorar Eventos', path: ROUTE_PATHS.EXPLORE },
      { label: 'Em Alta', path: ROUTE_PATHS.EM_ALTA },
      { label: 'Categorias', path: ROUTE_PATHS.CATEGORIES },
      { label: 'Novidades', path: ROUTE_PATHS.NEWS },
    ],
    organizers: [
      { label: 'Venda seus Ingressos', path: ROUTE_PATHS.SELL_TICKETS },
      { label: 'Soluções para Eventos', path: '#' },
      { label: 'Cases de Sucesso', path: '#' },
      { label: 'Área do Organizador', path: '#' },
    ],
    legal: [
      { label: 'Termos de Uso', path: ROUTE_PATHS.TERMS },
      { label: 'Política de Privacidade', path: ROUTE_PATHS.PRIVACY },
      { label: 'Política de Cookies', path: '#' },
      { label: 'Compliance', path: '#' },
    ]
  };

  return (
    <footer className="bg-background border-t border-border/40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-16">
          {/* Brand Column */}
          <div className="lg:col-span-2 flex flex-col items-center text-center gap-6">
            <Link to={ROUTE_PATHS.HOME} className="inline-block hover:opacity-80 transition-opacity">
              <img 
                src={logoImage} 
                alt="Prefest" 
                className="h-20 w-auto object-contain"
              />
            </Link>
            <p className="text-muted-foreground leading-relaxed max-w-sm text-sm">
              Prefest é o seu marketplace definitivo para ingressos e conexões. 
              Transformamos a maneira como você descobre, compra e vivencia eventos, 
              conectando pessoas através de experiências inesquecíveis.
            </p>
            
            <div className="flex items-center justify-center gap-4 mt-2">
              {[
                { icon: Instagram, href: "https://www.instagram.com/prefest.ofc" },
                { icon: Twitter, href: "#" },
                { icon: Facebook, href: "#" },
                { icon: Linkedin, href: "#" }
              ].map((social, index) => (
                <a 
                  key={index}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-primary/25"
                >
                  <social.icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* Links Columns */}
          <div className="flex flex-col items-center text-center gap-4">
            <h4 className="font-bold text-foreground text-lg">Descubra</h4>
            <ul className="space-y-3 flex flex-col items-center">
              {footerLinks.discover.map((link) => (
                <li key={link.label}>
                  <Link to={link.path} className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center group">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col items-center text-center gap-4">
            <h4 className="font-bold text-foreground text-lg">Organizadores</h4>
            <ul className="space-y-3 flex flex-col items-center">
              {footerLinks.organizers.map((link) => (
                <li key={link.label}>
                  <Link to={link.path} className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center group">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col items-center text-center gap-4">
            <h4 className="font-bold text-foreground text-lg">Legal</h4>
            <ul className="space-y-3 flex flex-col items-center">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link to={link.path} className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center group">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="bg-border/40 mb-8" />

        {/* Bottom Section */}
        <div className="flex flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground text-center">
            &copy; {currentYear} Prefest Tecnologia Ltda. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
